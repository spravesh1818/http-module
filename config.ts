export const config = {
  env: process.env.NODE_ENV,
  basename: process.env.REACT_APP_BASE_NAME,
  baseURI: process.env.REACT_APP_API_BASE_URI,
  authURI: process.env.REACT_APP_AUTH_URI,
  authClientId: process.env.REACT_APP_AUTH_CLIENT_ID,
  endpoints: {
    auth: {
      token: "/token",
      logout: "/logout",
    },
  },
};

export default config;
