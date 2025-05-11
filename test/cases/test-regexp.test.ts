import { expect } from 'chai';
import { ENTITY_MAP } from "../../src";
import { createEntitySet } from '../../src/utils';


describe('test-regexp', () => {
  const entitySet = createEntitySet([ENTITY_MAP.Worklog]);

  it(`should return true`, async () => {
    expect(entitySet.has('Worklog')).equal(true);
  });

  it(`should return false`, async () => {
    expect(entitySet.has('WorklogVersion')).equal(false);
  });
});
