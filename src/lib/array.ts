import { findIndex, findLastIndex, List, ListIterateeCustom } from "lodash";

export type MaybeArray<T> = T | T[];

export const last = <T>(arr: T[]) =>
  arr.length > 0 ? arr[arr.length - 1] : null;

export const findFirstAndLastIndex = <T>(
  array: List<T> | null | undefined,
  predicate?: ListIterateeCustom<T, boolean>,
  fromIndex?: number
): [number, number] => {
  return [
    findIndex(array, predicate, fromIndex),
    findLastIndex(array, predicate, fromIndex),
  ];
};

export const getInclusiveRangeWith = <T>(
  array: T[] | null | undefined,
  predicate?: ListIterateeCustom<T, boolean>,
  fromIndex?: number
): T[] => {
  if (!array) return [];
  const [start, end] = findFirstAndLastIndex(array, predicate, fromIndex);
  if (start < 0) return [];
  return array.slice(start, end + 1);
};
