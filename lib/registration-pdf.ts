import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { type Field, type FormDefinition } from "@/lib/enrollment-form";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const RIGHT = PAGE_WIDTH - MARGIN;
const BOTTOM = 58;
const ink = rgb(0.13, 0.22, 0.24);
const muted = rgb(0.35, 0.42, 0.42);
const teal = rgb(0.04, 0.43, 0.37);

// A print-ready blank copy of every question for the provider's location.
// Conditional questions stay in the PDF and include their display condition.
export async function createRegistrationPdf(definition: FormDefinition, version: number, country: string, region: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Courier);
  const bold = await pdf.embedFont(StandardFonts.CourierBold);
  const pages: PDFPage[] = [];
  let page!: PDFPage;
  let y = 0;

  const safe = (text: string, font: PDFFont) => Array.from(text).map(character => {
    try { font.encodeText(character); return character; } catch { return "?"; }
  }).join("");
  const wrap = (value: string, font: PDFFont, size: number, width: number) => {
    const lines: string[] = [];
    for (const paragraph of safe(value, font).split(/\r?\n/)) {
      let current = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) { current = candidate; continue; }
        if (current) { lines.push(current); current = ""; }
        for (const character of word) {
          if (current && font.widthOfTextAtSize(current + character, size) > width) { lines.push(current); current = ""; }
          current += character;
        }
      }
      lines.push(current);
    }
    return lines;
  };
  const addPage = () => {
    page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - MARGIN;
    if (pages.length > 1) {
      page.drawText("CHILD CARE REGISTRATION - CONTINUED", { x: MARGIN, y, font: bold, size: 8, color: teal });
      page.drawText(safe(`${region}, ${country}`, regular), { x: RIGHT - regular.widthOfTextAtSize(safe(`${region}, ${country}`, regular), 8), y, font: regular, size: 8, color: muted });
      y -= 22;
      page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT, y }, thickness: 0.7, color: rgb(0.81, 0.87, 0.85) });
      y -= 11;
    }
  };
  const ensure = (height: number) => { if (y - height < BOTTOM) addPage(); };
  const write = (value: string, font: PDFFont, size: number, leading: number, color = ink, indent = 0) => {
    for (const line of wrap(value, font, size, RIGHT - MARGIN - indent)) {
      ensure(leading);
      y -= leading;
      if (line) page.drawText(line, { x: MARGIN + indent, y, font, size, color });
    }
  };
  const answerLine = (caption?: string) => {
    ensure(21);
    y -= 18;
    if (caption) page.drawText(caption, { x: MARGIN + 12, y: y + 2, size: 8, font: regular, color: muted });
    page.drawLine({ start: { x: MARGIN + (caption ? 114 : 12), y }, end: { x: RIGHT - 12, y }, thickness: 0.55, color: rgb(0.68, 0.75, 0.73) });
  };
  const forLocation = (field: Field) => (!field.country || field.country === country) && (!field.region || field.region === region);
  const labels = new Map(definition.fields.map(field => [field.id, field.label]));

  addPage();
  write("CHILD CARE REGISTRATION FORM", bold, 18, 23, teal);
  write("Little Sprouts Early Learning", bold, 11, 18);
  write(`Provider location: ${region}, ${country}    |    Published form version ${version}`, regular, 9, 15, muted);
  y -= 7;
  write("Blank copy for review or printing. An asterisk marks a required question. Conditional questions are included with their conditions; the online form shows them only when relevant.", regular, 9, 13, muted);
  y -= 12;

  for (const section of definition.sections) {
    const fields = definition.fields.filter(field => field.section === section.id && forLocation(field));
    ensure(92);
    y -= 12;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: RIGHT, y }, thickness: 1.2, color: teal });
    write(section.title, bold, 13, 23, teal);
    if (section.help) write(section.help, regular, 9, 13, muted);
    y -= 5;
    if (!fields.length) write(`No additional questions for ${region}, ${country} in this section.`, regular, 9, 14, muted);
    for (const field of fields) {
      ensure(76);
      y -= 9;
      write(`${field.label}${field.required ? " *" : ""}`, bold, 10, 14);
      if (field.when) write(`Show if: ${labels.get(field.when.field) || field.when.field} = ${field.when.value}`, regular, 8, 12, teal, 12);
      if (field.help) write(field.help, regular, 8, 11, muted, 12);
      if (field.type === "select" && field.options?.length) write(`Choices: ${field.options.join(" / ")}`, regular, 8, 11, muted, 12);
      if (field.type === "document") answerLine("Document attached:");
      else if (field.type === "people") {
        for (let person = 1; person <= 2; person++) {
          answerLine(`Person ${person}: name`);
          answerLine("Relationship / phone");
          answerLine("Email / address");
        }
        write("Add another person on a separate sheet if needed.", regular, 8, 11, muted, 12);
      } else {
        const count = field.type === "textarea" ? 3 : 1;
        for (let line = 0; line < count; line++) answerLine();
      }
      y -= 6;
    }
  }

  for (const [index, item] of pages.entries()) {
    item.drawLine({ start: { x: MARGIN, y: 48 }, end: { x: RIGHT, y: 48 }, thickness: 0.6, color: rgb(0.81, 0.87, 0.85) });
    item.drawText(`Little Sprouts Early Learning  |  ${safe(region, regular)}, ${safe(country, regular)}  |  Form v${version}`, { x: MARGIN, y: 32, size: 8, font: regular, color: muted });
    const count = `Page ${index + 1} of ${pages.length}`;
    item.drawText(count, { x: RIGHT - regular.widthOfTextAtSize(count, 8), y: 32, size: 8, font: regular, color: muted });
  }
  return pdf.save();
}
