'use strict';

const {Emitter} = require('atom');
const {StateController} = require('kite-installer');
const {head, hoverPath, reportPath, promisifyRequest, promisifyReadResponse} = require('./utils');
const VirtualCursor = require('./virtual-cursor');
const KiteHover = require('./elements/kite-hover');
const KiteExpand = require('./elements/kite-expand');

module.exports = {
  emitter: new Emitter(),

  onDidShowExpand(listener) {
    return this.emitter.on('did-show-expand', listener);
  },

  onDidShowHover(listener) {
    return this.emitter.on('did-show-hover', listener);
  },

  onDidDismiss(listener) {
    return this.emitter.on('did-dismiss', listener);
  },

  dismiss() {
    this.marker && this.marker.destroy();
    this.decoration && this.decoration.destroy();
    delete this.marker;
    delete this.decoration;
    delete this.lastHoverRange;
    delete this.lastExpandRange;
    delete this.hoverData;

    this.emitter.emit('did-dismiss');
  },

  showHoverAtPosition(editor, position) {
    const cursor = new VirtualCursor(editor, position);
    const range = cursor.getCurrentWordBufferRange({
      includeNonWordCharacters: false,
    });

    return this.showHoverAtRange(editor, range);
  },

  showHoverAtRange(editor, range) {
    if ((this.lastHoverRange && this.lastHoverRange.isEqual(range)) ||
        (this.lastExpandRange && this.lastExpandRange.isEqual(range))) {
      return Promise.resolve();
    }

    this.dismiss();

    if (range.isEmpty()) { return Promise.resolve(); }

    this.lastHoverRange = range;

    return this.getHoverDataAtRange(editor, range).then(data => {
      this.hoverData = data;
      if (data.symbol && data.symbol.length) {
        const hover = new KiteHover();
        hover.setData(data);

        this.marker = editor.markBufferRange(range, {
          invalidate: 'touch',
        });
        this.decoration = editor.decorateMarker(this.marker, {
          type: 'overlay',
          position: 'tail',
          item: hover,
        });
        this.emitter.emit('did-show-hover');
      }
    })
    .catch(err => {});
  },

  showExpandAtPosition(editor, position) {
    const cursor = new VirtualCursor(editor, position);
    const range = cursor.getCurrentWordBufferRange({
      includeNonWordCharacters: false,
    });

    return this.showExpandAtRange(editor, range);
  },

  showExpandAtRange(editor, range) {
    if (this.lastExpandRange && this.lastExpandRange.isEqual(range)) {
      return Promise.resolve();
    }

    const data = this.hoverData;

    this.dismiss();

    if (range.isEmpty()) { return Promise.resolve(); }

    this.lastExpandRange = range;

    return (data
      ? this.getReportDataFromHover(data)
      : this.getReportDataAtRange(editor, range)
    ).then(([hover, report]) => {
      console.log(JSON.stringify(hover, null, 2), report);
      if (hover.symbol && hover.symbol.length) {
        const expand = new KiteExpand();
        expand.setData(hover);

        this.marker = editor.markBufferRange(range, {
          invalidate: 'touch',
        });
        this.decoration = editor.decorateMarker(this.marker, {
          type: 'overlay',
          position: 'tail',
          item: expand,
        });
        this.emitter.emit('did-show-expand');
      }
    })
    .catch(err => {
      console.error(err);
    });
  },

  getHoverDataAtRange(editor, range) {
    const path = hoverPath(editor, range);
    return promisifyRequest(StateController.client.request({path}))
    .then(resp => {
      if (resp.statusCode !== 200) { throw new Error(`not found at ${path}`); }
      return promisifyReadResponse(resp);
    })
    .then(data => JSON.parse(data));
  },

  getReportDataAtRange(editor, range) {
    return this.getHoverDataAtRange(editor, range)
    .then(data => this.getReportDataFromHover(data));
  },

  getReportDataFromHover(data) {
    if (head(data.symbol).id === '') {
      return Promise.resolve([data, null]);
    }

    const path = reportPath(data);
    return promisifyRequest(StateController.client.request({path}))
    .then(resp => {
      if (resp.statusCode !== 200) { throw new Error(`not found at ${path}`); }
      return promisifyReadResponse(resp);
    })
    .then(report => [data, JSON.parse(report)]);
  },
};