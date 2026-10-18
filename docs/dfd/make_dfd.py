"""Generates Graduation Blueprint data flow diagrams (Gane-Sarson notation) as Inkscape SVGs.

  python docs/dfd/make_dfd.py            -> dfd-level0.svg, dfd-level1.svg
  inkscape <file>.svg --export-type=png,pdf   (done by the script when Inkscape is installed)

Edit the NODES / FLOWS below and re-run; or open the SVGs in Inkscape and move things by hand.
"""
import math
import os
import shutil
import subprocess
from html import escape

HERE = os.path.dirname(os.path.abspath(__file__))

PURPLE = "#4D1979"
DEEP = "#2A1640"
TEAL = "#A3CED6"
SOFT = "#EFE7F7"
STORE = "#F4F1F8"
INK = "#2A1640"
MUTED = "#6B607A"
LINE = "#4D1979"
FONT = "Segoe UI, Montserrat, Arial, sans-serif"


class Node:
    def __init__(self, nid, kind, x, y, w, h, title, sub="", tag=""):
        self.id, self.kind, self.x, self.y, self.w, self.h = nid, kind, x, y, w, h
        self.title, self.sub, self.tag = title, sub, tag

    @property
    def cx(self):
        return self.x + self.w / 2

    @property
    def cy(self):
        return self.y + self.h / 2

    def edge_point(self, tx, ty):
        """Where the line from this node's center toward (tx, ty) leaves its rectangle."""
        dx, dy = tx - self.cx, ty - self.cy
        if dx == 0 and dy == 0:
            return self.cx, self.cy
        sx = (self.w / 2) / abs(dx) if dx else math.inf
        sy = (self.h / 2) / abs(dy) if dy else math.inf
        s = min(sx, sy)
        return self.cx + dx * s, self.cy + dy * s


def text_lines(x, y, lines, size, weight="400", color=INK, anchor="middle", lh=1.25):
    out = []
    for i, ln in enumerate(lines):
        out.append(
            f'<text x="{x:.1f}" y="{y + i * size * lh:.1f}" font-family="{FONT}" font-size="{size}" '
            f'font-weight="{weight}" fill="{color}" text-anchor="{anchor}">{escape(ln)}</text>'
        )
    return "\n".join(out)


def wrap(s, n):
    words, lines, cur = s.split(), [], ""
    for w in words:
        if len(cur) + len(w) + 1 > n and cur:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return lines


def draw_node(n):
    g = [f'<g id="{n.id}" inkscape:label="{escape(n.tag + " " + n.title).strip()}">']
    if n.kind == "entity":
        dup = n.tag.endswith("*")
        g.append(f'<rect x="{n.x+6}" y="{n.y+6}" width="{n.w}" height="{n.h}" fill="{DEEP}" opacity="0.18"/>')
        g.append(f'<rect x="{n.x}" y="{n.y}" width="{n.w}" height="{n.h}" fill="{PURPLE}" stroke="{DEEP}" stroke-width="2"/>')
        if dup:  # duplicate entity marker (Gane-Sarson): a short diagonal in the corner
            g.append(f'<line x1="{n.x+n.w-18}" y1="{n.y+n.h}" x2="{n.x+n.w}" y2="{n.y+n.h-18}" stroke="#fff" stroke-width="2"/>')
        tl = wrap(n.title, 18)
        sl = wrap(n.sub, 30) if n.sub else []
        total = len(tl) * 18 + len(sl) * 14
        y0 = n.cy - total / 2 + 14
        g.append(text_lines(n.cx, y0, tl, 16, "700", "#fff"))
        if sl:
            g.append(text_lines(n.cx, y0 + len(tl) * 20, sl, 11.5, "400", "#E9DDF5"))
    elif n.kind == "process":
        g.append(f'<rect x="{n.x}" y="{n.y}" width="{n.w}" height="{n.h}" rx="16" fill="#fff" stroke="{PURPLE}" stroke-width="2.5"/>')
        g.append(f'<path d="M{n.x},{n.y+16} a16,16 0 0 1 16,-16 h{n.w-32} a16,16 0 0 1 16,16 v12 h-{n.w} z" fill="{PURPLE}"/>')
        g.append(text_lines(n.cx, n.y + 22, [n.tag], 12, "800", "#fff"))
        tl = wrap(n.title, 26)
        sl = wrap(n.sub, 34) if n.sub else []
        body_top, body_h = n.y + 28, n.h - 28
        total = len(tl) * 17 + len(sl) * 14
        y0 = body_top + (body_h - total) / 2 + 12
        g.append(text_lines(n.cx, y0, tl, 14, "700", INK))
        if sl:
            g.append(text_lines(n.cx, y0 + len(tl) * 17 + 2, sl, 11, "400", MUTED))
    elif n.kind == "store":
        idw = 44
        g.append(f'<rect x="{n.x}" y="{n.y}" width="{n.w}" height="{n.h}" fill="{STORE}"/>')
        g.append(f'<path d="M{n.x+n.w},{n.y} H{n.x} V{n.y+n.h} H{n.x+n.w}" fill="none" stroke="{PURPLE}" stroke-width="2"/>')
        g.append(f'<line x1="{n.x+idw}" y1="{n.y}" x2="{n.x+idw}" y2="{n.y+n.h}" stroke="{PURPLE}" stroke-width="2"/>')
        g.append(text_lines(n.x + idw / 2, n.cy + 5, [n.tag], 13, "800", PURPLE))
        lines = [n.title] + ([n.sub] if n.sub else [])
        y0 = n.cy - (len(lines) - 1) * 8 + 5
        g.append(text_lines(n.x + idw + 10, y0, [n.title], 13.5, "700", INK, "start"))
        if n.sub:
            g.append(text_lines(n.x + idw + 10, y0 + 16, [n.sub], 11, "400", MUTED, "start"))
    g.append("</g>")
    return "\n".join(g)


def draw_flow(nodes, f, idx):
    a, b = nodes[f["from"]], nodes[f["to"]]
    via = f.get("via", [])
    off = f.get("offset", 0)
    pts_mid = [tuple(p) for p in via]
    first_target = pts_mid[0] if pts_mid else (b.cx, b.cy)
    last_source = pts_mid[-1] if pts_mid else (a.cx, a.cy)
    p0 = a.edge_point(*first_target)
    p1 = b.edge_point(*last_source)
    # "x": a straight vertical flow at that x; "y": a straight horizontal flow at that y
    if "x" in f:
        x = f["x"]
        top, bot = (a, b) if a.cy < b.cy else (b, a)
        ya, yb = top.y + top.h, bot.y
        p0, p1 = ((x, ya), (x, yb)) if a is top else ((x, yb), (x, ya))
    elif "y" in f:
        y = f["y"]
        left, right = (a, b) if a.cx < b.cx else (b, a)
        xa, xb = left.x + left.w, right.x
        p0, p1 = ((xa, y), (xb, y)) if a is left else ((xb, y), (xa, y))
    # "pa" / "pb": fixed start / end points
    if "pa" in f:
        p0 = tuple(f["pa"])
    if "pb" in f:
        p1 = tuple(f["pb"])
    pts = [p0] + pts_mid + [p1]
    # parallel offset for two-way pairs (straight flows only)
    if off and not pts_mid and "x" not in f and "y" not in f:
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]
        L = math.hypot(dx, dy) or 1
        nx, ny = -dy / L * off, dx / L * off
        pts = [(p0[0] + nx, p0[1] + ny), (p1[0] + nx, p1[1] + ny)]
    d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    dash = ' stroke-dasharray="7,5"' if f.get("dashed") else ""
    out = [f'<g id="flow{idx}" inkscape:label="flow: {escape(f["label"])}">']
    out.append(f'<path d="{d}" fill="none" stroke="{LINE}" stroke-width="1.8"{dash} marker-end="url(#arrow)"/>')
    # label on the chosen segment
    seg = f.get("seg", len(pts) // 2 - (0 if len(pts) % 2 else 1))
    seg = max(0, min(seg, len(pts) - 2))
    t = f.get("t", 0.5)
    (x0, y0), (x1, y1) = pts[seg], pts[seg + 1]
    lx, ly = x0 + (x1 - x0) * t + f.get("dx", 0), y0 + (y1 - y0) * t + f.get("dy", 0)
    lines = wrap(f["label"], f.get("wrap", 26))
    size = 11.5
    w = max(len(s) for s in lines) * size * 0.56 + 10
    h = len(lines) * size * 1.25 + 6
    out.append(f'<rect x="{lx - w/2:.1f}" y="{ly - h/2:.1f}" width="{w:.1f}" height="{h:.1f}" rx="3" fill="#fff" opacity="0.94"/>')
    out.append(text_lines(lx, ly - h / 2 + size + 1.5, lines, size, "600" if not f.get("dashed") else "500", INK if not f.get("dashed") else MUTED))
    out.append("</g>")
    return "\n".join(out)


def svg_doc(width, height, title, subtitle, nodes, flows, legend=True, footer=""):
    defs = f"""<defs>
  <marker id="arrow" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill="{LINE}"/>
  </marker>
</defs>"""
    head = [
        f'<rect x="0" y="0" width="{width}" height="{height}" fill="#ffffff"/>',
        f'<rect x="0" y="0" width="{width}" height="8" fill="{PURPLE}"/>',
        text_lines(40, 52, [title], 26, "800", PURPLE, "start"),
        text_lines(40, 78, [subtitle], 14, "400", MUTED, "start"),
    ]
    leg = []
    if legend:
        lx, ly = width - 520, 28
        leg = [
            f'<g id="legend" inkscape:label="Legend">',
            f'<rect x="{lx}" y="{ly}" width="490" height="62" fill="#fff" stroke="#E3DCEC"/>',
            f'<rect x="{lx+12}" y="{ly+14}" width="34" height="22" fill="{PURPLE}"/>',
            text_lines(lx + 52, ly + 30, ["External entity"], 11.5, "600", INK, "start"),
            f'<rect x="{lx+160}" y="{ly+12}" width="38" height="26" rx="7" fill="#fff" stroke="{PURPLE}" stroke-width="2"/>',
            f'<rect x="{lx+160}" y="{ly+12}" width="38" height="8" rx="4" fill="{PURPLE}"/>',
            text_lines(lx + 204, ly + 30, ["Process"], 11.5, "600", INK, "start"),
            f'<path d="M{lx+310},{ly+14} H{lx+270} V{ly+36} H{lx+310}" fill="{STORE}" stroke="{PURPLE}" stroke-width="2"/>',
            text_lines(lx + 316, ly + 30, ["Data store"], 11.5, "600", INK, "start"),
            f'<line x1="{lx+392}" y1="{ly+20}" x2="{lx+430}" y2="{ly+20}" stroke="{LINE}" stroke-width="1.8" marker-end="url(#arrow)"/>',
            text_lines(lx + 436, ly + 24, ["Flow"], 11.5, "600", INK, "start"),
            f'<line x1="{lx+392}" y1="{ly+44}" x2="{lx+430}" y2="{ly+44}" stroke="{LINE}" stroke-width="1.8" stroke-dasharray="6,4" marker-end="url(#arrow)"/>',
            text_lines(lx + 436, ly + 48, ["Planned"], 11.5, "600", MUTED, "start"),
            "</g>",
        ]
    foot = [text_lines(40, height - 22, [footer], 11.5, "400", MUTED, "start")] if footer else []
    body_flows = [draw_flow(nodes, f, i) for i, f in enumerate(flows)]
    body_nodes = [draw_node(n) for n in nodes.values()]
    return f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"
     xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"
     width="{width}" height="{height}" viewBox="0 0 {width} {height}">
<sodipodi:namedview pagecolor="#ffffff" inkscape:document-units="px"/>
{defs}
<g inkscape:groupmode="layer" id="layer-frame" inkscape:label="Frame">
{chr(10).join(head + leg + foot)}
</g>
<g inkscape:groupmode="layer" id="layer-flows" inkscape:label="Data flows">
{chr(10).join(body_flows)}
</g>
<g inkscape:groupmode="layer" id="layer-nodes" inkscape:label="Entities, processes, stores">
{chr(10).join(body_nodes)}
</g>
</svg>
"""


# ───────────────────────── Level 0: context diagram ─────────────────────────
L0 = {n.id: n for n in [
    Node("sys", "process", 640, 330, 380, 200, "Graduation Blueprint", "Planning engine + Claude explanations + advisor review", "0"),
    Node("stu", "entity", 90, 360, 220, 120, "Student", "Neeley undergraduate"),
    Node("adv", "entity", 1350, 610, 230, 110, "Academic Advisor", "Neeley advising"),
    Node("tcu", "entity", 680, 130, 300, 100, "TCU Official Sources", "Catalog · Neeley checklists · course export · tuition rates"),
    Node("ai", "entity", 1350, 170, 230, 110, "Anthropic Claude API", "claude-opus-5-5"),
    Node("reg", "entity", 680, 690, 300, 100, "Registrar / my.tcu.edu", "degree audit · registration"),
]}
L0_FLOWS = [
    {"from": "stu", "to": "sys", "label": "profile, transcript, survey answers, questions, what-if choices", "offset": -14, "wrap": 30, "dy": -38},
    {"from": "sys", "to": "stu", "label": "Graduation Blueprint, costs, recommendations, explanations, weekly schedule, Excel plan", "offset": -14, "wrap": 30, "dy": 44},
    {"from": "tcu", "to": "sys", "label": "courses, prerequisites, program rules, tuition", "wrap": 28, "dx": 120},
    {"from": "sys", "to": "ai", "label": "conversation + engine tool results", "offset": -12, "wrap": 22, "t": 0.35, "dx": -40, "dy": -34},
    {"from": "ai", "to": "sys", "label": "replies, tool requests", "offset": -12, "wrap": 22, "t": 0.6, "dx": 30, "dy": 30},
    {"from": "sys", "to": "adv", "label": "checked plan + flagged questions", "offset": -12, "wrap": 22, "dy": -26},
    {"from": "adv", "to": "sys", "label": "approve / request changes", "offset": -12, "wrap": 22, "dy": 26},
    {"from": "reg", "to": "sys", "label": "course records (sample now; authorized export later)", "dashed": True, "wrap": 30, "dx": 150},
]

# ───────────────────────── Level 1: inside the system ─────────────────────────
PW, PH = 230, 104
SW, SH = 240, 48
R1, R3 = 300, 790  # process rows
L1 = {n.id: n for n in [
    # external entities (Student is drawn wide so each process reaches it with a short vertical flow)
    Node("stu", "entity", 230, 125, 1140, 64, "Student"),
    Node("stu2", "entity", 280, 1080, 1010, 60, "Student", "", "*"),
    Node("adv", "entity", 20, 1050, 190, 80, "Advisor"),
    Node("ai", "entity", 1440, R1, 200, 104, "Anthropic Claude API"),
    Node("tcu", "entity", 1580, 470, 220, 110, "TCU Official Sources", "catalog · checklists · course export · tuition · Class Search"),
    # processes
    Node("p2", "process", 280, R1, PW, PH, "Recommend Pathways", "majors, minors, careers, match %", "2.0"),
    Node("p1", "process", 540, R1, PW, PH, "Sign In & Intake", "auth · Planning Survey · transcript confirm", "1.0"),
    Node("p3", "process", 800, R1, PW, 120, "Build & Validate Plan", "planning engine: requirements, prereqs, Core, scheduling, 10 checks", "3.0"),
    Node("p5", "process", 1120, R1, PW, PH, "Converse & Explain", "Claude chat, calls engine tools", "5.0"),
    Node("p7", "process", 280, R3, PW, PH, "Advisor Review", "approve / request changes", "6.0"),
    Node("p8", "process", 540, R3, PW, PH, "Build Section Schedule", "weekly calendar, preferences", "7.0"),
    Node("p4", "process", 800, R3, PW, PH, "Compare What-Ifs & Cost", "TCU tuition table + Neeley fee", "4.0"),
    Node("p0", "process", 1580, 660, 220, PH, "Import Planning Pack", "npm run data:pack", "0.0"),
    # data stores
    Node("d4", "store", 20, 520, 230, SH, "Careers", "careers.json", "D4"),
    Node("d6", "store", 290, 520, SW, SH, "Survey Responses", "interests, locations, load", "D6"),
    Node("d5", "store", 550, 520, SW, SH, "Student Records", "course_records (+ source)", "D5"),
    Node("d2", "store", 1110, 520, 270, SH, "Programs, Rules & Tuition", "programs.json", "D2"),
    Node("d1", "store", 1110, 600, 270, SH, "Courses", "courses.json · 3,887 courses", "D1"),
    Node("d3", "store", 1110, 680, 270, SH, "Sections", "sections.json (SAMPLE)", "D3"),
    Node("d7", "store", 290, 960, SW, SH, "Reviews & Saved Plans", "advisor_reviews, saved_plans", "D7"),
]}
L1_FLOWS = [
    # Student <-> processes along the top: down arrow left, up arrow right; labels outside the pair
    {"from": "p2", "to": "stu", "label": "majors, minors, careers + match %", "x": 395, "wrap": 14, "dx": 56},
    {"from": "stu", "to": "p1", "label": "sign-in, survey, transcript", "x": 615, "wrap": 12, "dx": -50},
    {"from": "p1", "to": "stu", "label": "rows to confirm", "x": 695, "wrap": 9, "dx": 40},
    {"from": "stu", "to": "p3", "label": "what-ifs: minor, load, Core swap", "x": 875, "wrap": 11, "dx": -50},
    {"from": "p3", "to": "stu", "label": "Blueprint: plan, checks, flags, cost, Excel", "x": 955, "wrap": 12, "dx": 50},
    {"from": "stu", "to": "p5", "label": "question", "x": 1195, "dx": -36},
    {"from": "p5", "to": "stu", "label": "answer + sources", "x": 1275, "wrap": 9, "dx": 40},
    # intake writes, recommendations read
    {"from": "p1", "to": "d5", "label": "confirmed courses", "x": 625, "wrap": 10, "t": 0.22, "dx": -42},
    {"from": "d5", "to": "p1", "label": "profile", "x": 700, "t": 0.72, "dx": 28},
    {"from": "p1", "to": "d6", "label": "survey answers", "pa": [560, 404], "pb": [500, 520], "wrap": 9, "t": 0.8, "dx": -40},
    {"from": "d6", "to": "p2", "label": "interests, year, places", "x": 395, "wrap": 11, "dx": -42},
    {"from": "d4", "to": "p2", "label": "roles, employers", "pa": [200, 520], "pb": [300, 404], "wrap": 9, "t": 0.5, "dx": -34},
    {"from": "p2", "to": "p3", "label": "picked program (one-click build)", "pa": [470, 404], "via": [[470, 462], [845, 462]], "pb": [845, 420], "seg": 1, "t": 0.5, "wrap": 34, "dy": -1},
    # engine inputs
    {"from": "d5", "to": "p3", "label": "course history", "pa": [790, 530], "pb": [830, 420], "wrap": 8, "t": 0.45, "dx": 28},
    {"from": "d2", "to": "p3", "label": "requirements, rules", "pa": [1110, 544], "pb": [1015, 420], "wrap": 12, "t": 0.18, "dx": 4, "dy": -16},
    {"from": "d1", "to": "p3", "label": "prereqs, Core tags", "pa": [1110, 624], "pb": [990, 420], "wrap": 10, "t": 0.12, "dx": -28, "dy": -10},
    {"from": "d3", "to": "p3", "label": "offerings", "pa": [1110, 704], "pb": [965, 420], "t": 0.1, "dx": -22, "dy": -8},
    # chat
    {"from": "p5", "to": "p3", "label": "tool calls", "y": 335, "dy": -11},
    {"from": "p3", "to": "p5", "label": "plan facts", "y": 380, "dy": 12},
    {"from": "p5", "to": "ai", "label": "messages + tool results", "y": 335, "wrap": 12, "dy": -22},
    {"from": "ai", "to": "p5", "label": "reply, tool calls", "y": 380, "wrap": 10, "dy": 22},
    # compare + cost
    {"from": "p3", "to": "p4", "label": "base + what-if plans", "x": 915, "wrap": 10, "t": 0.62, "dx": -42},
    {"from": "d2", "to": "p4", "label": "tuition rates", "pa": [1110, 556], "pb": [1005, 790], "wrap": 8, "t": 0.62, "dx": 28},
    {"from": "p4", "to": "stu2", "label": "What changes, added cost", "x": 915, "wrap": 12, "dx": 50},
    # review and schedule
    {"from": "stu", "to": "p7", "label": "send plan for review", "pa": [262, 189], "via": [[262, 842]], "pb": [280, 842], "seg": 0, "t": 0.78, "wrap": 8, "dx": -32},
    {"from": "adv", "to": "p7", "label": "decision", "pa": [170, 1050], "pb": [300, 894], "t": 0.45, "dx": -34},
    {"from": "p7", "to": "adv", "label": "review queue", "pa": [330, 894], "pb": [210, 1080], "t": 0.82, "wrap": 8, "dx": 44},
    {"from": "p7", "to": "d7", "label": "review + snapshot", "x": 420, "wrap": 9, "dx": 40},
    {"from": "d7", "to": "p8", "label": "approved plan", "pa": [530, 960], "pb": [580, 894], "wrap": 8, "t": 0.5, "dx": 36},
    {"from": "d3", "to": "p8", "label": "sections, times", "pa": [1110, 716], "pb": [745, 790], "wrap": 9, "t": 0.5, "dy": -18},
    {"from": "p8", "to": "stu2", "label": "weekly schedule", "x": 680, "wrap": 9, "dx": 40},
    # data maintenance
    {"from": "tcu", "to": "p0", "label": "catalog, checklists, export, tuition", "x": 1690, "wrap": 14, "dx": 62},
    {"from": "p0", "to": "d2", "label": "programs.json", "pa": [1580, 690], "pb": [1380, 544], "t": 0.45, "dy": -14},
    {"from": "p0", "to": "d1", "label": "courses.json", "pa": [1580, 720], "pb": [1380, 624], "t": 0.5, "dy": 14},
    {"from": "tcu", "to": "d3", "label": "Class Search pull (planned)", "dashed": True, "pa": [1580, 560], "via": [[1480, 560], [1480, 704]], "pb": [1380, 704], "seg": 2, "t": 0.5, "wrap": 14, "dy": 22},
]


def build(name, width, height, title, subtitle, nodes, flows, footer):
    path = os.path.join(HERE, name)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(svg_doc(width, height, title, subtitle, nodes, flows, footer=footer))
    return path


def export(svg):
    exe = shutil.which("inkscape") or r"C:\Program Files\Inkscape\bin\inkscape.exe"
    if not os.path.exists(exe) and not shutil.which("inkscape"):
        print("Inkscape not found; SVG only:", svg)
        return
    base = os.path.splitext(svg)[0]
    subprocess.run([exe, svg, "--export-type=png", f"--export-filename={base}.png", "--export-dpi=150"], check=True)
    subprocess.run([exe, svg, "--export-type=pdf", f"--export-filename={base}.pdf"], check=True)
    print("exported", base + ".png", base + ".pdf")


if __name__ == "__main__":
    a = build(
        "dfd-level0.svg", 1680, 860,
        "Graduation Blueprint · Data Flow Diagram, Level 0 (Context)",
        "The whole system as one process and everything outside it that sends or receives data.",
        L0, L0_FLOWS,
        "Gane-Sarson notation. Dashed = planned: course records come from labeled sample data today; an authorized degree-audit export replaces it.",
    )
    b = build(
        "dfd-level1.svg", 1830, 1200,
        "Graduation Blueprint · Data Flow Diagram, Level 1",
        "The engine decides (3.0, 4.0 and 7.0 are deterministic code); Claude (5.0) only explains, using engine tool results. Student* is the same entity drawn twice.",
        L1, L1_FLOWS,
        "D1-D4 are JSON files re-read at runtime (update data without a rebuild). D5-D7 live in Supabase Postgres with row-level security: students see only their own rows; advisors see all. D3 Sections is SAMPLE data until the Class Search pull.",
    )
    for s in (a, b):
        export(s)
