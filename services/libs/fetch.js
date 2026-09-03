class FetchService {
  constructor() {
    this._headers = {};
    this._baseUrl = '';
  }

  headers(headers) {
    const instance = this._clone();
    instance._headers = { ...instance._headers, ...headers };
    return instance;
  }

  baseUrl(url) {
    const instance = this._clone();
    instance._baseUrl = url;
    return instance;
  }

  _clone() {
    const instance = new FetchService();
    instance._headers = { ...this._headers };
    instance._baseUrl = this._baseUrl;
    return instance;
  }

  _buildUrl(url) {
    if (this._baseUrl && !url.startsWith('http')) {
      return `${this._baseUrl.replace(/\/$/, '')}/${url.replace(/^\//, '')}`;
    }
    return url;
  }

  async _request(method, url, body) {
    const opts = {
      method,
      headers: { ...this._headers }
    };
    if (body !== undefined) {
      if (typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
        opts.body = JSON.stringify(body);
        opts.headers['Content-Type'] = opts.headers['Content-Type'] || 'application/json';
      } else {
        opts.body = body;
      }
    }
    const response = await fetch(this._buildUrl(url), opts);
    return new FetchResponse(response);
  }

  get(url) {
    return this._request('GET', url);
  }

  post(url, body) {
    return this._request('POST', url, body);
  }

  put(url, body) {
    return this._request('PUT', url, body);
  }

  delete(url, body) {
    return this._request('DELETE', url, body);
  }

  patch(url, body) {
    return this._request('PATCH', url, body);
  }
}

class FetchResponse {
  constructor(response) {
    this._response = response;
    this.ok = response.ok;
    this.status = response.status;
    this.statusText = response.statusText;
    this.headers = response.headers;
    this.url = response.url;
  }

  json() {
    return this._response.json();
  }

  text() {
    return this._response.text();
  }

  blob() {
    return this._response.blob();
  }

  arrayBuffer() {
    return this._response.arrayBuffer();
  }
}

export default new FetchService();
