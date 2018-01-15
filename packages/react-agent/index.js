import React, { Component, cloneElement } from 'react';
import io from 'socket.io-client';
const uuidv4 = require('uuid/v4');

class Store extends Component {
  constructor(props) {
    super(props);
    this.state = props.store;
  }

  addToStore(key, value) { this.setState({ [key]: value }) }

  render() { return cloneElement(this.props.children, this.state) }
}

let store, socket = io.connect();
const cache = {};
const subscriptions = {};

window.addEventListener('online', () => {
  socket = io.connect();
});

socket.on('connect', () => {
  Object.values(cache).forEach(({ key, request, queryId }) => {
    socket.emit('query', { key, request, queryId });
  });
});

socket.on('response', data => {
  if (cache[data.queryId]) {
    if (data.preError) cache[data.queryId].reject(data.preError);
    else if (data.databaseError) cache[data.queryId].reject(data.databaseError);
    else cache[data.queryId].resolve(data.response);
    delete cache[data.queryId];
  }
});

socket.on('subscriber', data => { subscriptions[data.key].func(data.response) });

export const Agent = (props) => {
  store = new Store(props);
  return store;
}

export const query = (key, request) => {
  const queryId = uuidv4();
  socket.emit('query', { key, request, queryId });
  return new Promise((resolve, reject) => {
    cache[queryId] = { key, request, queryId, resolve, reject };
  });
};

export const subscribe = (key, func) => {
  socket.emit('subscribe', { key });
  subscriptions[key] = { func };
};

export const emit = (key, request) => {
  const queryId = uuidv4();
  socket.emit('emit', { key, request, queryId });
  return new Promise((resolve, reject) => {
    cache[queryId] = { key, request, queryId, resolve, reject };
  });
};

export const set = (...args) => {
  for (let i = 0; i < args.length; i = i + 2) {
    if (i + 1 === args.length) store.addToStore(args[i], null);
    else store.addToStore(args[i], args[i + 1]);
  }
};

export const get = (...keys) => {
  if (keys.length > 1) {
    const results = {};
    keys.forEach(key => results[key] = store.state[key]);
    return results;
  } else {
    if (keys[0] === 'store') {
      return store.state;
    } else {
      return store.state[keys[0]];
    }
  }
};

export const getStore = () => store;
