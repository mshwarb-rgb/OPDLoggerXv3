import ExcelJS from 'exceljs';
import { DX } from './dx.js';
import { AGE_GROUPS, DISPOSITIONS } from './stats.js';

function autosize(ws){
  ws.columns.forEach(col=>{
    let max = 10;
    col.eachCell({ includeEmpty:true }, (cell)=>{
      const v = cell.value;
      const s = v?.formula ? v.formula : (v ?? '');
      max = Math.max(max, String(s).length);
    });
    col.width = Math.min(45, max + 2);
  });
}

export async function exportDayXlsx({date, doctorName, visits}){
  const wb = new ExcelJS.Workbook();
  wb.creator = 'OPD LoggerX';
  wb.created = new Date();

  const raw = wb.addWorksheet('Raw Data');
  raw.columns = [
    { header:'Time', key:'time' },
    { header:'PatientID', key:'patientId' },
    { header:'Gender', key:'gender' },
    { header:'AgeGroup', key:'ageGroup' },
    { header:'Dx1', key:'dx1' },
    { header:'Dx2', key:'dx2' },
    { header:'WW_NWW', key:'wwFlag' },
    { header:'Disposition', key:'disposition' },
  ];
  raw.getRow(1).font = { bold:true };

  for(const v of visits){
    raw.addRow({
      time: v.time || '',
      patientId: v.patientId || '',
      gender: v.gender || '',
      ageGroup: v.ageGroup || '',
      dx1: v.dx1 || '',
      dx2: v.dx2 || '',
      wwFlag: v.wwFlag || '',
      disposition: v.disposition || ''
    });
  }

  const sum = wb.addWorksheet('Day Summary');
  sum.getCell('A1').value = 'OPD LoggerX - Day Summary';
  sum.getCell('A1').font = { bold:true, size: 14 };

  sum.getCell('A3').value = 'Doctor'; sum.getCell('B3').value = doctorName || '';
  sum.getCell('A4').value = 'Date'; sum.getCell('B4').value = date;
  sum.getCell('A5').value = 'Exported at'; sum.getCell('B5').value = new Date().toISOString();

  ['A3','A4','A5'].forEach(a=> sum.getCell(a).font = { bold:true });

  sum.getCell('A7').value = 'Total visits';
  sum.getCell('B7').value = { formula: "COUNTA('Raw Data'!B:B)-1" };

  sum.getCell('A8').value = 'Male';
  sum.getCell('B8').value = { formula: "COUNTIF('Raw Data'!C:C,"M")" };

  sum.getCell('A9').value = 'Female';
  sum.getCell('B9').value = { formula: "COUNTIF('Raw Data'!C:C,"F")" };

  sum.getCell('A11').value = 'WW';
  sum.getCell('B11').value = { formula: "COUNTIF('Raw Data'!G:G,"WW")" };
  sum.getCell('A12').value = 'Non-WW';
  sum.getCell('B12').value = { formula: "COUNTIF('Raw Data'!G:G,"NWW")" };

  ['A7','A8','A9','A11','A12'].forEach(a=> sum.getCell(a).font = { bold:true });

  sum.getCell('A14').value = 'Disposition';
  sum.getCell('A14').font = { bold:true };

  let r = 15;
  for(const d of DISPOSITIONS){
    sum.getCell(`A${r}`).value = d;
    sum.getCell(`B${r}`).value = { formula: `COUNTIF('Raw Data'!H:H,"${d}")` };
    r++;
  }

  r += 1;
  sum.getCell(`A${r}`).value = 'Age by gender';
  sum.getCell(`A${r}`).font = { bold:true };
  r++;

  sum.getCell(`A${r}`).value = 'AgeGroup';
  sum.getCell(`B${r}`).value = 'Male';
  sum.getCell(`C${r}`).value = 'Female';
  sum.getRow(r).font = { bold:true };
  r++;

  for(const ag of AGE_GROUPS){
    sum.getCell(`A${r}`).value = ag;
    sum.getCell(`B${r}`).value = { formula: `COUNTIFS('Raw Data'!D:D,"${ag}",'Raw Data'!C:C,"M")` };
    sum.getCell(`C${r}`).value = { formula: `COUNTIFS('Raw Data'!D:D,"${ag}",'Raw Data'!C:C,"F")` };
    r++;
  }

  r += 1;
  sum.getCell(`A${r}`).value = 'Diagnoses (Dx1+Dx2)';
  sum.getCell(`A${r}`).font = { bold:true };
  r++;

  sum.getCell(`A${r}`).value = 'Dx';
  sum.getCell(`B${r}`).value = 'Code';
  sum.getCell(`C${r}`).value = 'Name';
  sum.getCell(`D${r}`).value = 'Count';
  sum.getRow(r).font = { bold:true };
  r++;

  for(const dx of DX){
    sum.getCell(`A${r}`).value = dx.id;
    sum.getCell(`B${r}`).value = dx.code;
    sum.getCell(`C${r}`).value = dx.name;
    sum.getCell(`D${r}`).value = { formula: `COUNTIF('Raw Data'!E:E,${dx.id})+COUNTIF('Raw Data'!F:F,${dx.id})` };
    r++;
  }

  autosize(raw); autosize(sum);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
