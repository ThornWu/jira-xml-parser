import { expect } from 'chai';
import { readObjectFile } from '../../src';
import fs from 'fs';
import path from 'path';

describe('extract object file', () => {
  const xmlPath = path.join(__dirname, '../xml-files', 'activeobjects.xml');
  const jsonPath = path.join(__dirname, '../expected-json', 'object-file.json');
  const allJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  it(`should correctly extract object file`, async () => {
    // 使用 readObjectFile 处理 XML
    const result = await readObjectFile(xmlPath, ['AO_60DB71_RAPIDVIEW', 'AO_60DB71_SPRINT']);
    // 比较结果
    expect(result).to.deep.equal(allJson);
  });
});
