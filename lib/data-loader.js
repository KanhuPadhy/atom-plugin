'use strict';

const {StateController} = require('kite-installer');
const {hoverPath, openInWebURL, promisifyRequest, promisifyReadResponse, head, valueReportPath} = require('./utils');
const {symbolId} = require('./kite-data-utils');
const VirtualCursor = require('./virtual-cursor');

const DataLoader = {
  getHoverDataAtRange(editor, range) {
    const path = hoverPath(editor, range);
    return promisifyRequest(StateController.client.request({path}))
      .then(resp => {
        if (resp.statusCode !== 200) {
          throw new Error(`${resp.statusCode} status at ${path}`);
        }
        return promisifyReadResponse(resp);
      })
      .then(data => JSON.parse(data));
  },

  getReportDataAtRange(editor, range) {
    return this.getHoverDataAtRange(editor, range)
      .then(data => this.getReportDataFromHover(data));
  },

  getReportDataFromHover(data) {
    const id = head(head(data.symbol).value).id;
    return this.getValueReportDataForId(id)
    .then(report => [data, report])
    .catch(err => {
      console.error(err);
      return [data];
    });
  },

  getValueReportDataForId(id) {
    const path = valueReportPath(id);

    return promisifyRequest(StateController.client.request({path}))
      .then(resp => {
        if (resp.statusCode !== 200) {
          throw new Error(`${resp.statusCode} at ${path}`);
        }
        return promisifyReadResponse(resp);
      })
      .then(report => JSON.parse(report));
  },

  openInWebAtPosition(editor, position) {
    const cursor = new VirtualCursor(editor, position);
    const range = cursor.getCurrentWordBufferRange({
      includeNonWordCharacters: false,
    });

    return this.getHoverDataAtRange(editor, range).then(data => {
      const id = symbolId(head(data.symbol));
      atom.applicationDelegate.openExternal(openInWebURL(id));
    });
  },
};

module.exports = DataLoader;