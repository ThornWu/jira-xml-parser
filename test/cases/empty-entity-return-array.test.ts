import { expect } from 'chai';
import { readEntityFile } from '../../src';
import path from 'path';
import { ENTITY_MAP } from '../../src/constants';

describe('empty entity match', () => {
  const xmlPath = path.join(__dirname, '../xml-files', 'entities.xml');
  it(`should return empty array`, async () => {
    // 使用 readEntityFile 处理 XML
    const result = await readEntityFile(xmlPath, [ENTITY_MAP.Action], () => false);
    // 比较结果
    expect(result).to.deep.equal({
      [ENTITY_MAP.Action]: []
    });
  });
});
