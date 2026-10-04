import { describe, expect, it } from "vitest"
import { strToU8, zipSync } from "fflate"
import { columnIndex, xlsxToCsv } from "./xlsx"

function workbook(sheetXml: string, shared?: string[]): Uint8Array {
  const files: Record<string, Uint8Array> = {
    "xl/workbook.xml": strToU8(
      `<workbook xmlns:r="r"><sheets><sheet name="Contacts" sheetId="1" r:id="rId1"/></sheets></workbook>`
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships><Relationship Id="rId1" Type="ws" Target="worksheets/sheet1.xml"/></Relationships>`
    ),
    "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData>${sheetXml}</sheetData></worksheet>`),
  }
  if (shared) {
    files["xl/sharedStrings.xml"] = strToU8(
      `<sst>${shared.map((s) => `<si><t>${s}</t></si>`).join("")}</sst>`
    )
  }
  return zipSync(files)
}

describe("columnIndex", () => {
  it("maps letters to zero-based columns", () => {
    expect(columnIndex("A1")).toBe(0)
    expect(columnIndex("Z9")).toBe(25)
    expect(columnIndex("AA3")).toBe(26)
  })
})

describe("xlsxToCsv", () => {
  it("reads shared strings, numbers and inline strings", () => {
    const xml =
      `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>` +
      `<row r="2"><c r="A2"><v>919876543210</v></c><c r="B2" t="inlineStr"><is><t>Doe, J</t></is></c></row>`
    expect(xlsxToCsv(workbook(xml, ["phone", "name"]))).toBe('phone,name\n919876543210,"Doe, J"')
  })

  it("keeps gaps for skipped cells and rows", () => {
    const xml =
      `<row r="1"><c r="A1" t="str"><v>phone</v></c><c r="C1" t="str"><v>city</v></c></row>` +
      `<row r="3"><c r="A3"><v>911</v></c></row>`
    expect(xlsxToCsv(workbook(xml))).toBe("phone,,city\n,,\n911,,")
  })

  it("writes a number in exponent form back as digits", () => {
    const xml = `<row r="1"><c r="A1"><v>9.19876543210E+11</v></c></row>`
    expect(xlsxToCsv(workbook(xml))).toBe("919876543210")
  })

  it("decodes XML entities", () => {
    const xml = `<row r="1"><c r="A1" t="inlineStr"><is><t>A &amp; B</t></is></c></row>`
    expect(xlsxToCsv(workbook(xml))).toBe("A & B")
  })

  it("rejects something that isn't a zip", () => {
    expect(() => xlsxToCsv(strToU8("phone,name"))).toThrow(/xlsx/)
  })

  // An empty row written as <row r="2"/> used to swallow the row after it.
  it("does not lose the row after a self-closing empty row", () => {
    const xml =
      `<row r="1"><c r="A1" t="str"><v>phone</v></c></row>` +
      `<row r="2" spans="1:1"/>` +
      `<row r="3"><c r="A3"><v>911</v></c></row>`
    expect(xlsxToCsv(workbook(xml))).toBe("phone\n\n911")
  })

  it("reads a formula's cached value", () => {
    const xml = `<row r="1"><c r="A1"><f>A2*1</f><v>919876543210</v></c></row>`
    expect(xlsxToCsv(workbook(xml))).toBe("919876543210")
  })

  it("joins rich-text runs and ignores phonetic guides", () => {
    const files = {
      "xl/workbook.xml": strToU8(`<workbook xmlns:r="r"><sheets><sheet r:id="rId1"/></sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(
        `<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>`
      ),
      "xl/worksheets/sheet1.xml": strToU8(
        `<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c></row></sheetData></worksheet>`
      ),
      "xl/sharedStrings.xml": strToU8(
        `<sst><si><r><t>Ta</t></r><r><t xml:space="preserve">ro </t></r><rPh sb="0" eb="1"><t>ignored</t></rPh></si></sst>`
      ),
    }
    expect(xlsxToCsv(zipSync(files))).toBe("Taro ")
  })

  it("falls back to the first worksheet when the workbook has no relationships", () => {
    const files = {
      "xl/worksheets/sheet2.xml": strToU8(`<worksheet><sheetData><row r="1"><c r="A1" t="str"><v>b</v></c></row></sheetData></worksheet>`),
      "xl/worksheets/sheet1.xml": strToU8(`<worksheet><sheetData><row r="1"><c r="A1" t="str"><v>a</v></c></row></sheetData></worksheet>`),
    }
    expect(xlsxToCsv(zipSync(files))).toBe("a")
  })

  it("returns nothing for an empty sheet", () => {
    expect(xlsxToCsv(workbook(""))).toBe("")
  })
})
