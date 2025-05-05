import { expect } from 'chai';
import { readEntityFile } from '../../src';
import fs from 'fs';
import path from 'path';
import { ENTITY_MAP } from '../../src/constants';

describe('extract multiple entity', () => {
  const xmlPath = path.join(__dirname, '../xml-files', 'entities.xml');
  const jsonPath = path.join(__dirname, '../expected-json', 'all-entity-alone.json');
  const allJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  it(`should correctly extract multiple entity`, async () => {
    // 使用 readEntityFile 处理 XML
    const result = await readEntityFile(xmlPath, [ENTITY_MAP.Action, ENTITY_MAP.Issue]);
    // 比较结果
    expect(result).to.deep.equal({ [ENTITY_MAP.Action]: allJson[ENTITY_MAP.Action], [ENTITY_MAP.Issue]: allJson[ENTITY_MAP.Issue]});
  });
});
