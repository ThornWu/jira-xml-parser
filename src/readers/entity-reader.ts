import { createReader, XmlNode } from '../big-xml';
import { EntityType } from '../constants';
import { createEntityPattern } from '../utils';


export const readEntityFile = async (filename: string, entities: Array<EntityType>, _compareFunc?: (record: Record<string, any>) => boolean) => {
  const entityPattern = createEntityPattern(entities);
  const reader = createReader(filename, { entityPattern, childrenAsProps: true });
  const records: Record<string, Array<Omit<XmlNode, '_tag'>>> = {};
  const compareFunc = typeof _compareFunc === 'function' ? _compareFunc : () => true;

  return new Promise((resolve, reject) => {
    reader.on('record', function(record) {
      if (!compareFunc(record)) {
        return;
      }
      const tagName = record._tag;
      delete record._tag;
      if (!records[tagName]) {
        records[tagName] = [record];
      } else {
        records[tagName].push(record);
      }
    })
    reader.on('end', function() {
      resolve(records);
    })
    reader.on('error', function(err) {
      reject(err);
    })
  });
}
