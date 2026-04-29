'use strict';

const path = require('path');
const cdk  = require('aws-cdk-lib');
const {
  aws_ec2:         ec2,
  aws_rds:         rds,
  aws_cognito:     cognito,
  aws_lambda:      lambda,
  aws_apigateway:  apigw,
  aws_s3:          s3,
  aws_s3_deployment: s3deploy,
  aws_cloudfront:  cf,
  aws_cloudfront_origins: cfOrigins,
  aws_iam:         iam,
  aws_secretsmanager: sm,
  Duration, RemovalPolicy, CfnOutput, SecretValue,
} = cdk;
const { Construct } = require('constructs');

class PtoStack extends cdk.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);

    // ── VPC ─────────────────────────────────────────────────────────────────
    const vpc = new ec2.Vpc(this, 'PtoVpc', {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'Public',  subnetType: ec2.SubnetType.PUBLIC,              cidrMask: 24 },
        { name: 'Private', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    // ── Security Groups ──────────────────────────────────────────────────────
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSg', { vpc, description: 'PTO Lambda' });
    const dbSg     = new ec2.SecurityGroup(this, 'DbSg',     { vpc, description: 'PTO RDS'    });
    dbSg.addIngressRule(lambdaSg, ec2.Port.tcp(5432), 'Lambda to RDS');

    // ── RDS Credentials ─────────────────────────────────────────────────────
    const dbSecret = new sm.Secret(this, 'DbSecret', {
      secretName: 'illuminate-pto/db',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'pto_admin' }),
        generateStringKey: 'password',
        excludePunctuation: true,
        passwordLength: 32,
      },
    });

    // ── RDS PostgreSQL ───────────────────────────────────────────────────────
    const db = new rds.DatabaseInstance(this, 'PtoDb', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets:     { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [dbSg],
      credentials:    rds.Credentials.fromSecret(dbSecret),
      databaseName:   'pto',
      removalPolicy:  RemovalPolicy.SNAPSHOT,
      deletionProtection: false,
      backupRetention: Duration.days(7),
      multiAz: false,
    });

    // ── Cognito ──────────────────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'PtoUserPool', {
      userPoolName: 'illuminate-pto',
      selfSignUpEnabled: false,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
        tempPasswordValidity: Duration.days(7),
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });

    // Cognito groups (roles)
    new cognito.CfnUserPoolGroup(this, 'AdminGroup',    { userPoolId: userPool.userPoolId, groupName: 'admin',    precedence: 1 });
    new cognito.CfnUserPoolGroup(this, 'ManagerGroup',  { userPoolId: userPool.userPoolId, groupName: 'manager',  precedence: 2 });
    new cognito.CfnUserPoolGroup(this, 'EmployeeGroup', { userPoolId: userPool.userPoolId, groupName: 'employee', precedence: 3 });

    const appClient = userPool.addClient('PtoAppClient', {
      userPoolClientName: 'pto-web-app',
      authFlows: {
        userPassword: true,
        userSrp: true,
        adminUserPassword: true,
      },
      generateSecret: false,
      accessTokenValidity:  Duration.hours(8),
      idTokenValidity:      Duration.hours(8),
      refreshTokenValidity: Duration.days(30),
    });

    // ── Anthropic API Key (store your key here after deploy) ─────────────────
    const anthropicSecret = new sm.Secret(this, 'AnthropicSecret', {
      secretName: 'illuminate-pto/anthropic-key',
      // After deploy: aws secretsmanager put-secret-value --secret-id illuminate-pto/anthropic-key --secret-string '{"key":"sk-ant-..."}'
      secretStringValue: SecretValue.unsafePlainText('{"key":"REPLACE_AFTER_DEPLOY"}'),
    });

    // ── Lambda ───────────────────────────────────────────────────────────────
    const apiFunction = new lambda.Function(this, 'ApiFunction', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../../backend'), {
        exclude: ['.env*', '*.test.js', 'nodemon.json'],
      }),
      handler: 'handler.handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        DB_HOST:                    db.dbInstanceEndpointAddress,
        DB_PORT:                    db.dbInstanceEndpointPort,
        DB_NAME:                    'pto',
        DB_SECRET_ARN:              dbSecret.secretArn,
        DB_SSL:                     'true',
        COGNITO_USER_POOL_ID:       userPool.userPoolId,
        COGNITO_CLIENT_ID:          appClient.userPoolClientId,
        ANTHROPIC_API_KEY_SECRET_ARN: anthropicSecret.secretArn,
        NODE_ENV:                   'production',
        AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1',
      },
      vpc,
      vpcSubnets:     { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      timeout:     Duration.seconds(30),
      memorySize:  512,
    });

    dbSecret.grantRead(apiFunction);
    anthropicSecret.grantRead(apiFunction);

    // ── API Gateway REST ─────────────────────────────────────────────────────
    // Auth is handled inside Lambda (middleware/auth.js verifies Cognito JWTs)
    // so API Gateway is open — no authorizer needed at this layer.
    const api = new apigw.LambdaRestApi(this, 'PtoApi', {
      handler: apiFunction,
      proxy: true,
      description: 'Illuminate PTO API',
      deployOptions: { stageName: 'prod', throttlingRateLimit: 100, throttlingBurstLimit: 200 },
      defaultCorsPreflightOptions: {
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Authorization', 'Content-Type'],
        maxAge: Duration.days(1),
      },
    });

    // ── S3 for frontend ──────────────────────────────────────────────────────
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `illuminate-pto-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // ── CloudFront ───────────────────────────────────────────────────────────
    const oai = new cf.OriginAccessIdentity(this, 'OAI');
    siteBucket.grantRead(oai);

    // API Gateway origin (strip /prod stage prefix via function)
    const apiDomain = `${api.restApiId}.execute-api.${this.region}.amazonaws.com`;

    const distribution = new cf.Distribution(this, 'SiteDistribution', {
      defaultBehavior: {
        origin: new cfOrigins.S3Origin(siteBucket, { originAccessIdentity: oai }),
        viewerProtocolPolicy: cf.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cf.CachePolicy.CACHING_OPTIMIZED,
        allowedMethods: cf.AllowedMethods.ALLOW_GET_HEAD,
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new cfOrigins.HttpOrigin(apiDomain, {
            originPath: '/prod',
            protocolPolicy: cf.OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: cf.ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: cf.AllowedMethods.ALLOW_ALL,
          cachePolicy: cf.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cf.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: Duration.seconds(0) },
      ],
      priceClass: cf.PriceClass.PRICE_CLASS_100,
    });

    // ── Outputs ──────────────────────────────────────────────────────────────
    new CfnOutput(this, 'SiteUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'Frontend URL (CloudFront) — this is your live URL',
    });
    new CfnOutput(this, 'ApiUrl', {
      value: `${api.url}`,
      description: 'API Gateway endpoint',
    });
    new CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID → VITE_COGNITO_USER_POOL_ID',
    });
    new CfnOutput(this, 'UserPoolClientId', {
      value: appClient.userPoolClientId,
      description: 'Cognito App Client ID → VITE_COGNITO_CLIENT_ID',
    });
    new CfnOutput(this, 'DbEndpoint', {
      value: db.dbInstanceEndpointAddress,
      description: 'RDS endpoint (for running schema migration)',
    });
    new CfnOutput(this, 'CloudFrontDistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront Distribution ID (for cache invalidation)',
    });
    new CfnOutput(this, 'S3BucketName', {
      value: siteBucket.bucketName,
      description: 'S3 bucket for frontend deployment',
    });
    new CfnOutput(this, 'DbSecretArn', {
      value: dbSecret.secretArn,
      description: 'Secrets Manager ARN for DB credentials',
    });
    new CfnOutput(this, 'AnthropicSecretArn', {
      value: anthropicSecret.secretArn,
      description: 'Update this secret with your Anthropic API key after deploy',
    });
  }
}

module.exports = { PtoStack };
