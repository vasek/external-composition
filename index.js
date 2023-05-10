const express = require("express");
const cors = require("cors");
const { parse, printSchema } = require("graphql");
const { composeServices } = require("@apollo/composition");
const {
  compose,
  signatureHeaderName,
  verifyRequest,
} = require("@graphql-hive/external-composition");

const composeFederation = compose((services) => {
  const result = composeServices(
    services.map((service) => {
      return {
        typeDefs: parse(service.sdl),
        name: service.name,
        url: service.url,
      };
    })
  );

  if (result.errors?.length) {
    return {
      type: "failure",
      result: {
        errors: result.errors.map((error) => ({
          message: error.message,
          source:
            typeof error.extensions?.code === "string"
              ? "composition"
              : "graphql",
        })),
      },
    };
  } else {
    return {
      type: "success",
      result: {
        supergraph: result.supergraphSdl,
        sdl: printSchema(result.schema.toGraphQLJSSchema()),
      },
    };
  }
});

const app = express();
app.use(
  cors({
    allowedHeaders: [
      "X-CSRF-Token",
      "X-Requested-With",
      "Accept",
      "Accept-Version",
      "Content-Length",
      "Content-MD5",
      "Content-Type",
      "Date",
      "X-Api-Version",
      "X-Hive-Signature-256",
    ],
    origin: "*",
    optionsSuccessStatus: 200,
    methods: ["GET", "OPTIONS", "PATCH", "DELETE", "POST", "PUT"],
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("Hello world");
  return;
});

app.options("/api/compose", (req, res) => {
  res.status(200).end();
  return;
});

app.post("/api/compose", (req, res) => {
  const error = verifyRequest({
    // Stringified body, or raw body if you have access to it
    body: JSON.stringify(req.body),
    // Pass here the signature from `X-Hive-Signature-256` header
    signature: req.headers[signatureHeaderName],
    // Pass here the secret you configured in Hive
    secret: "__SECRET__",
  });

  if (error) {
    // Failed to verify the request - send 500 and the error message back
    res.status(500).send(error);
  } else {
    const result = composeFederation(req.body);
    // Send the result back (as JSON)
    res.send(JSON.stringify(result));
  }
});

app.listen(3000, () => {
  "App listening on port 3000";
});
