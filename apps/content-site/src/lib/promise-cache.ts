export const trackPromise = <Key extends string, Value>(
  promises: Partial<Record<Key, Promise<Value>>>,
  key: Key,
  promise: Promise<Value>
): Promise<Value> => {
  const trackedPromise = promise.finally(() => {
    if (promises[key] === trackedPromise) {
      delete promises[key];
    }
  });

  promises[key] = trackedPromise;
  return trackedPromise;
};
