import { describe, expect, it, vi } from 'vitest';
import { when } from 'mobx';

import { MutationQuery } from './MutationQuery';

describe('MutationQuery', () => {
  it('Init state: флаги false, данные undefined', () => {
    const store = new MutationQuery(() => Promise.resolve('foo'));

    expect(store.isError).toBe(false);
    expect(store.isLoading).toBe(false);
    expect(store.error).toBe(undefined);
  });

  it('sync: стандартная загрузка успешна', async () => {
    const onSyncSuccess = vi.fn();
    const store = new MutationQuery(() => Promise.resolve('foo'));

    store.sync({ onSuccess: onSyncSuccess });
    expect(store.isLoading).toBe(true);
    await when(() => !store.isLoading);
    expect(onSyncSuccess).toBeCalledWith('foo');
    expect(store.isLoading).toBe(false);
  });

  it('async: стандартная загрузка успешна', async () => {
    const onAsyncSuccess = vi.fn();
    const store = new MutationQuery(() => Promise.resolve('foo'));

    await store.async().then(onAsyncSuccess);
    expect(onAsyncSuccess).toBeCalledWith('foo');
    expect(store.isLoading).toBe(false);
  });

  it('sync: При вызове передаются параметры', async () => {
    const callBack = vi.fn();
    const store = new MutationQuery((params: string) => {
      callBack(params);

      return Promise.resolve('foo');
    });

    store.sync({ params: 'bar' });
    await when(() => !store.isLoading);
    expect(callBack).toBeCalledWith('bar');
  });

  it('async: При вызове передаются параметры', async () => {
    const callBack = vi.fn();
    const store = new MutationQuery((params: string) => {
      callBack(params);

      return Promise.resolve('foo');
    });

    await store.async('bar');
    expect(callBack).toBeCalledWith('bar');
  });

  it('sync: при провальном запросе вызывается onError', async () => {
    const store = new MutationQuery(() => Promise.reject('foo'));

    store.sync({
      onError: (e) => {
        expect(store.isLoading).toBe(false);
        expect(store.isError).toBe(true);
        expect(e).toBe('foo');
      },
    });
  });

  it('sync: при провальном запросе вызывается стандартный onError', async () => {
    const store = new MutationQuery(() => Promise.reject('foo'), {
      onError: (e) => {
        expect(store.isLoading).toBe(false);
        expect(store.isError).toBe(true);
        expect(e).toBe('foo');
      },
    });

    store.sync();
  });

  it('async: При провальном запросе вызывается не вызывается стандартный onError', async () => {
    const onDefaultError = vi.fn();
    const onAsyncError = vi.fn();
    const store = new MutationQuery(() => Promise.reject('foo'), {
      onError: onDefaultError,
    });

    await store.async().catch(onAsyncError);
    expect(store.isError).toBe(true);
    expect(onAsyncError).toBeCalledWith('foo');
    expect(onDefaultError).not.toBeCalled();
  });
});