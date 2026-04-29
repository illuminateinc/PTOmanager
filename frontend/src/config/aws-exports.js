// Populated by: npx node ../infra/scripts/write-env.js  (runs automatically in deploy.sh)
// Or set these manually from CDK stack outputs.
const awsExports = {
  Auth: {
    Cognito: {
      userPoolId:       import.meta.env.VITE_COGNITO_USER_POOL_ID  || '',
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID     || '',
      loginWith: { email: true },
    },
  },
};

export default awsExports;
