import { describe, it, expect } from 'vitest';
import { readEntityFile } from '../../src';
import fs from 'fs';
import path from 'path';
import { ENTITY_MAP } from '../../src/constants';

describe('validate-all-entity-alone', () => {
  const xmlPath = path.join(__dirname, '../xml-files', 'entities.xml');
  const jsonPath = path.join(__dirname, '../expected-json', 'all-entity-alone.json');
  const allJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // 遍历 ENTITY_MAP 中的所有实体类型
  Object.keys(ENTITY_MAP).forEach((entityType: any) => {
    it(`should correctly convert ${entityType} to JSON`, async () => {
      // 使用 readEntityFile 处理 XML
      const result = await readEntityFile(xmlPath, [entityType]);
      // 比较结果
      expect((result as any)[entityType]).toEqual(allJson[entityType]);
    });
  });
});
