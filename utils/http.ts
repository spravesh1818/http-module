import axios from "axios";
import HttpStatus from "http-status";
import log from "loglevel";

import { config } from "../config";
import { logout } from "../services/auth.service";
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
} from "../services/token.service";

const REFRESH_TOKEN_URL = `${config.authURI}${config.endpoints.auth.token}`;

const instance = axios.create({
  baseURL: config.baseURI,
  headers: {
    "Content-Type": "application/json",
  },
});

// eslint-disable-next-line no-unused-vars
type RequestResendFunction = (token: string) => void;
let isRefreshingAccessToken = false;
let unauthorizedRequestQueue: RequestResendFunction[] = [];

/**
 * @param {String} url The url for the api request (without the base).
 * @param {Object} [config]
 * @param {Object} [config.params] An object of queries that will be added to
 * the url.
 * @param {Object} [config.body] An object that will be sent in the request
 * body.
 * @param {Boolean} [config.accessToken] Whether or not to include the
 * access-token header.
 * @returns {Promise}
 */
function post(
  url: string,
  { params = {}, body = {}, accessToken = true, headers = {} } = {}
) {
  const authHeaders: { Authorization?: string } = {};

  if (accessToken) {
    authHeaders.Authorization = `Bearer ${getAccessToken()}`;
  }

  return instance({
    url,
    params,
    data: body,
    method: "post",
    headers: { ...authHeaders, ...headers },
  })
    .then((response) => response)
    .catch((error) => {
      log.error(error);
      throw new Error(error?.response?.data?.error);
    });
}

/**
 * @param {String} url The url for the api request (without the base).
 * @param {Object} [config]
 * @param {Object} [config.params] An object of queries that will be added to
 * the url.
 * @param {Object} [config.body] An object that will be sent in the request
 * body.
 * @returns {Promise}
 */
function put(
  url: string,
  { params = {}, body = {}, accessToken = true, headers = {} } = {}
) {
  const authHeaders: { Authorization?: string } = {};

  if (accessToken) {
    authHeaders.Authorization = `Bearer ${getAccessToken()}`;
  }

  return instance({
    url,
    params,
    data: body,
    method: "put",
    headers: { ...authHeaders, ...headers },
  })
    .then((response) => response)
    .catch((error) => {
      log.error(error);
      throw new Error(error?.response?.data?.error);
    });
}

/**
 * @param {String} url The url for the api request (without the base).
 * @param {Object} [config]
 * @param {Object} [config.params] An object of queries that will be added to
 * the url.
 * @param {Boolean} [config.accessToken] Whether or not to include the
 * access-token header.
 * @param {Object} cancelToken The tokenized reference to the original request.
 * @returns {Promise}
 */
function get(
  url: string,
  { params = {}, accessToken = true, headers = {} } = {}
) {
  const authHeaders: { Authorization?: string } = {};

  if (accessToken) {
    authHeaders.Authorization = `Bearer ${getAccessToken()}`;
  }

  return instance({
    url,
    params,
    method: "get",
    headers: { ...authHeaders, ...headers },
  })
    .then((response) => response)
    .catch((error) => {
      log.error(error);
      throw new Error(error?.response?.data?.error);
    });
}

/**
 * @param {String} url The url for the api request (without the base).
 * @param {Object} [config]
 * @param {Object} [config.params] An object of queries that will be added to
 * the url.
 * @param {Boolean} [config.accessToken] Whether or not to include the
 * access-token header.
 * @param {Object} cancelToken The tokenized reference to the original request.
 * @returns {Promise}
 */
function del(
  url: string,
  { params = {}, accessToken = true, headers = {} } = {}
) {
  const authHeaders: { Authorization?: string } = {};

  if (accessToken) {
    authHeaders.Authorization = `Bearer ${getAccessToken()}`;
  }

  return instance({
    url,
    params,
    method: "delete",
    headers: { ...authHeaders, ...headers },
  })
    .then((response) => response)
    .catch((error) => {
      log.error(error);
      throw new Error(error?.response?.data?.error);
    });
}

const http = {
  get,
  post,
  put,
  del,
};

export async function refreshAccessToken() {
  const refreshToken = getRefreshToken();

  const clientId = config.authClientId;
  const { data } = await post(REFRESH_TOKEN_URL, {
    body: { refreshToken, clientId },
  });

  return data;
}

/**
 * Changes access token of the provided request.
 *
 * @param {Object} originalRequest
 * @param {Object} newToken
 */
function changeAccessToken(originalRequest: any, newToken: string) {
  return {
    ...originalRequest,
    headers: {
      ...originalRequest.headers,
      Authorization: `Bearer ${newToken}`,
    },
  };
}

/**
 * Calls pending requests from unauthorized request queue.
 *
 * @param {String} refreshedAccessToken
 */
function callRequestsFromUnauthorizedQueue(refreshedAccessToken: string) {
  unauthorizedRequestQueue.map((cb) => cb(refreshedAccessToken));
}

/**
 * Clears unauthorized request queue.
 */
function clearUnauthorizedRequestQueue() {
  unauthorizedRequestQueue = [];
}

/**
 * Subscribe retry request to access token refresh.
 * Add request to unauthorized request queue.
 *
 * @param {Function} callback
 */
function subscribeToAccessTokenRefresh(callback: RequestResendFunction) {
  unauthorizedRequestQueue.push(callback);
}

export async function unauthorizedResponseHandlerInterceptor(err: any) {
  const originalRequest = err.config;
  if (!originalRequest) {
    return Promise.reject(err);
  }
  const code = err.response && err.response.status;
  const path = originalRequest.url;
  if (
    code === HttpStatus.UNAUTHORIZED &&
    originalRequest.url === REFRESH_TOKEN_URL
  ) {
    logout();
    log.info("Logging out");
    return Promise.reject(err);
  }

  if (code === HttpStatus.UNAUTHORIZED && path !== REFRESH_TOKEN_URL) {
    try {
      const refreshToken = getRefreshToken();

      if (!refreshToken) {
        log.info("Logging out");
        logout();
      }

      if (!isRefreshingAccessToken) {
        isRefreshingAccessToken = true;
        const { accessToken }: { accessToken: string } =
          await refreshAccessToken();

        setAccessToken(accessToken);
        const newRequest = changeAccessToken(originalRequest, accessToken);

        callRequestsFromUnauthorizedQueue(accessToken);

        clearUnauthorizedRequestQueue();

        isRefreshingAccessToken = false;
        return await instance.request(newRequest);
      }

      const retryRequest = new Promise((resolve) => {
        subscribeToAccessTokenRefresh((refreshedAccessToken: string) => {
          const newRequest = changeAccessToken(
            originalRequest,
            refreshedAccessToken
          );

          resolve(instance.request(newRequest));
        });
      });

      return await retryRequest;
    } catch (error) {
      log.error(error);
      logout();
    }
  }

  return Promise.reject(err);
}

instance.interceptors.response.use(
  (response) => {
    return response;
  },
  (err) => unauthorizedResponseHandlerInterceptor(err)
);

export default http;
