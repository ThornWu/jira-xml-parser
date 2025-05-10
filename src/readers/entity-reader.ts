import { EntityParser, type XmlNode } from '../xml-parser/entity-parser';
import { EntityType } from '../constants';
import { createEntityPattern, getLastEntityType } from '../utils';


type IRecord = Omit<XmlNode, '_tag'>;

export const readEntityFile = async (filename: string, entities: Array<EntityType>, _compareFunc?: (record: Record<string, unknown>) => boolean) => {
  const lastEntity = getLastEntityType(entities);
  const entityPattern = createEntityPattern(entities);
  const reader = new EntityParser(filename, { entityPattern, lastEntity });
  const records: Record<string, Array<IRecord>> = entities.reduce((acc, current) => {
    acc[current] = [];
    return acc;
  }, {} as Record<string, Array<IRecord>>);
  const compareFunc = typeof _compareFunc === 'function' ? _compareFunc : () => true;

  return new Promise((resolve, reject) => {
    reader.on('record', function(_record: XmlNode) {
      if (!compareFunc(_record)) {
        return;
      }
      const { _tag, _level, children = [], ...record } = _record;
      if (children.length > 0) {
        children.forEach((child: XmlNode) => {
          record[child._tag] = child.text;
        });
      }
      const tagName = _tag;
      records[tagName].push(record);
    })

    reader.on('end', function() {
      resolve(records);
    })

    reader.on('error', function(err: Error) {
      reject(err);
    })
  });
}
