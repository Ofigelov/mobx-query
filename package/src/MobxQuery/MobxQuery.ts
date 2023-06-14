import { Query, QueryExecutor, QueryParams } from '../Query';
import {
  InfiniteExecutor,
  InfiniteQuery,
  InfiniteQueryParams,
} from '../InfiniteQuery';
import {
  MutationExecutor,
  MutationQuery,
  MutationQueryParams,
} from '../MutationQuery';
import { FetchPolicy } from '../types';

/**
 * @description стандартный обработчик ошибки запроса,
 * будет вызван, если при вызове sync не был передан отдельный onError параметр
 */
type OnError<TError = unknown> = (error: TError) => void;

/**
 * @description хэш ключа
 */
type KeyHash = string;

type MobxQueryParams = {
  fetchPolicy: FetchPolicy;
  onError?: OnError;
  /**
   * @description флаг, отвечающий за автоматический запрос данных при обращении к полю data
   * @default false
   */
  enabledAutoFetch?: boolean;
};

type CreateCacheableQueryParams<TResult, TError> = QueryParams<TResult, TError>;

type CreateInfiniteQueryParams<TResult, TError> = InfiniteQueryParams<
  TResult,
  TError
>;

/**
 * @description внутриний тип кешируемого стора
 */
type CachedQueryStore<TResult, TError> =
  | Query<TResult, TError>
  | InfiniteQuery<TResult, TError>;

/**
 * @description ключ для кешированя квери
 */
export type CacheKey = string | string[] | number | { [key: string]: CacheKey };

/**
 * @description Сервис, позволяющий кэшировать данные.
 */
export class MobxQuery {
  /**
   * @description объект соответствия хешей ключей и их значений
   */
  private keys: Record<KeyHash, CacheKey[]> = {};

  /**
   * @description Map соответствия хешей ключей к запомненным сторам
   */
  private cacheableStores = new Map<
    KeyHash,
    CachedQueryStore<unknown, unknown>
  >();

  /**
   * @description стандартный обработчик ошибок, будет использован, если не передан другой
   */
  private readonly defaultErrorHandler?: OnError;

  /**
   * @description стандартное поведение политики кеширования
   */
  private readonly defaultFetchPolicy: FetchPolicy;

  /**
   * @description флаг, отвечающий за автоматический запрос данных при обращении к полю data
   * @default false
   */
  private readonly defaultEnabledAutoFetch: boolean;

  private serialize = (data: CacheKey | CacheKey[]) => JSON.stringify(data);

  constructor(
    { onError, fetchPolicy, enabledAutoFetch = false } = {} as MobxQueryParams,
  ) {
    this.defaultErrorHandler = onError;
    this.defaultFetchPolicy = fetchPolicy;
    this.defaultEnabledAutoFetch = enabledAutoFetch;
  }

  /**
   * @description метод для инвалидации по списку ключей,
   * предполагается использование из домена
   */
  public invalidate = (keysParts: CacheKey[]) => {
    // сет сериализовонных ключей
    const keysSet = new Set(keysParts.map(this.serialize));

    Object.keys(this.keys).forEach((key: KeyHash) => {
      const value = this.keys[key];
      // проверяем, есть ли пересечение между закешированными ключами и набором ключей для инвалидации
      const hasTouchedElement = value.some((valuePart) =>
        keysSet.has(this.serialize(valuePart)),
      );

      if (hasTouchedElement) {
        this.cacheableStores.get(key)?.invalidate();
      }
    });
  };

  /**
   * @description метод, который занимается проверкой наличия стора по ключу,
   * и если нет, создает новый, добавляет его к себе в память, и возвращает его пользователю
   */
  private getCachedQuery = <TResult, TError>(
    key: CacheKey[],
    createStore: () => CachedQueryStore<TResult, TError>,
  ) => {
    const keyHash: KeyHash = this.serialize(key);

    if (this.cacheableStores.has(keyHash)) {
      return this.cacheableStores.get(keyHash);
    }

    const store = createStore();

    this.cacheableStores.set(
      keyHash,
      store as CachedQueryStore<unknown, unknown>,
    );

    this.keys[keyHash] = key;

    return store;
  };

  /**
   * @description метод создания стора, кешируется
   */
  createQuery = <TResult, TError>(
    key: CacheKey[],
    executor: QueryExecutor<TResult>,
    params?: CreateCacheableQueryParams<TResult, TError>,
  ) =>
    this.getCachedQuery(
      key,
      () =>
        new Query(executor, {
          ...params,
          onError: (params?.onError ||
            this.defaultErrorHandler) as OnError<TError>,
          enabledAutoFetch:
            params?.enabledAutoFetch || this.defaultEnabledAutoFetch,
          fetchPolicy: params?.fetchPolicy || this.defaultFetchPolicy,
        }),
    ) as Query<TResult, TError>;

  /**
   * @description метод создания инфинит стора, кешируется
   */
  createInfiniteQuery = <TResult, TError>(
    key: CacheKey[],
    executor: InfiniteExecutor<TResult>,
    params?: CreateInfiniteQueryParams<TResult, TError>,
  ) =>
    this.getCachedQuery(
      key,
      () =>
        new InfiniteQuery(executor, {
          ...params,
          onError: (params?.onError ||
            this.defaultErrorHandler) as OnError<TError>,
          enabledAutoFetch:
            params?.enabledAutoFetch || this.defaultEnabledAutoFetch,
          fetchPolicy: params?.fetchPolicy || this.defaultFetchPolicy,
        }),
    ) as InfiniteQuery<TResult, TError>;

  /**
   * @description метод создания мутации, не кешируется
   */
  createMutationQuery = <TResult, TError, TExecutorParams>(
    executor: MutationExecutor<TResult, TExecutorParams>,
    params?: MutationQueryParams<TResult, TError>,
  ) =>
    new MutationQuery<TResult, TError, TExecutorParams>(executor, {
      ...params,
      onError: params?.onError || this.defaultErrorHandler,
    });
}