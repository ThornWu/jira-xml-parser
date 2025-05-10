import { EntityType } from "./constants";

/**
 * 生成匹配多个字符串的正则表达式
 * @param patterns 需要匹配的字符串数组
 * @returns 正则表达式
 */
export function createEntityPattern(patterns: string[]): RegExp {
  return new RegExp(`^(?:${patterns.join('|')})(?!\\w)`);
}

export function getLastEntityType(entities: Array<EntityType>): EntityType {
  return entities.sort((a, b) => a.localeCompare(b))[entities.length - 1];
}
