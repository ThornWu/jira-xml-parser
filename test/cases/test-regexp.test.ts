import { expect } from 'chai';
import { createEntityPattern, ENTITY_MAP } from "../../src";


describe('test-regexp', () => {
  const entityPattern = createEntityPattern([ENTITY_MAP.Worklog]);

  it(`should return true`, async () => {
    expect(entityPattern.test('Worklog')).equal(true);
  });

  it(`should return false`, async () => {
    expect(entityPattern.test('WorklogVersion')).equal(false);
  });
});
