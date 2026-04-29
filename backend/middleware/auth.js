const { CognitoJwtVerifier } = require('aws-jwt-verify');

let verifier;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: process.env.COGNITO_USER_POOL_ID,
      tokenUse: 'access',
      clientId: process.env.COGNITO_CLIENT_ID,
    });
  }
  return verifier;
}

async function authenticate(req, res, next) {
  // Skip auth in local dev when no Cognito is configured
  if (!process.env.COGNITO_USER_POOL_ID) {
    req.user = { cognitoSub: 'local-dev', role: 'admin', groups: ['admin'], email: 'dev@illuminate.net' };
    return next();
  }

  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  try {
    const token = auth.slice(7);
    const payload = await getVerifier().verify(token);
    const groups = payload['cognito:groups'] || [];

    let role = 'employee';
    if (groups.includes('admin')) role = 'admin';
    else if (groups.includes('manager')) role = 'manager';

    req.user = {
      cognitoSub: payload.sub,
      email: payload.email || payload['cognito:username'],
      groups,
      role,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authenticate };
