// netlify/functions/ping.js
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ok: true, node: process.version }),
  };
};
