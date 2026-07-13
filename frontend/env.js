// Auto-detect environment: use local backend when running on localhost
const isLocal =
  location.hostname === "localhost" ||
  location.hostname === "127.0.0.1" ||
  location.hostname === "0.0.0.0";

window.ENV = {
  API_URL: isLocal
    ? "http://localhost:4000/api"
    : "https://videoframer.onrender.com/api",
};
