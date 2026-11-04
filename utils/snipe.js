const store = new Map();

function set(channelId, data) {
  store.set(channelId, data);
}

function get(channelId) {
  return store.get(channelId);
}

module.exports = { set, get };
