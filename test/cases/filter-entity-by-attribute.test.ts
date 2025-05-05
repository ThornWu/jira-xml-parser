import { describe, it, expect } from 'vitest';
import { readEntityFile } from '../../src';
import fs from 'fs';
import path from 'path';
import { omitBy } from 'es-toolkit';
import { ENTITY_MAP } from '../../src/constants';

const issuesSet = new Set(['10011']);
const filterFunc = (record: any) => {
  return issuesSet.has(record.issue);
};

const arrayFilterFunc = (array: any[]) => {
  return array.filter((item: any) => filterFunc(item));
};

describe('filter-entity-by-attribute.test', () => {
  const xmlPath = path.join(__dirname, '../xml-files', 'entities.xml');
  const jsonPath = path.join(__dirname, '../expected-json', 'all-entity-alone.json');
  const allJson = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  it(`should filter-entity by multiple issue id`, async () => {
    // 使用 readEntityFile 处理 XML
    const result = await readEntityFile(xmlPath, [ENTITY_MAP.Action, ENTITY_MAP.CustomFieldValue, ENTITY_MAP.FileAttachment, ENTITY_MAP.Label, ENTITY_MAP.UserAssociation, ENTITY_MAP.Worklog], filterFunc);
    // 比较结果
    expect(result).toEqual(omitBy({
      [ENTITY_MAP.Action]: arrayFilterFunc(allJson[ENTITY_MAP.Action]),
      [ENTITY_MAP.CustomFieldValue]: arrayFilterFunc(allJson[ENTITY_MAP.CustomFieldValue]),
      [ENTITY_MAP.FileAttachment]: arrayFilterFunc(allJson[ENTITY_MAP.FileAttachment]),
      [ENTITY_MAP.Label]: arrayFilterFunc(allJson[ENTITY_MAP.Label]),
      [ENTITY_MAP.UserAssociation]: arrayFilterFunc(allJson[ENTITY_MAP.UserAssociation]),
      [ENTITY_MAP.Worklog]: arrayFilterFunc(allJson[ENTITY_MAP.Worklog])
    }, value => value.length === 0));
  });
});
