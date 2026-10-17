/**
 * Client Status API — paste into Extensions > Apps Script of your Google Sheet.
 *
 * 1. Run setupSheet() once: creates the Project / Tasks / Updates tabs and a secret key.
 * 2. Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).
 * 3. Run showClientLink() to see the key to put in the client's link.
 */

var SHEETS = { project: 'Project', tasks: 'Tasks', updates: 'Updates' };
var TASK_STATUSES = ['To do', 'In progress', 'Waiting for client', 'Blocked', 'Done'];
var PROJECT_STATUSES = ['On track', 'At risk', 'Delayed', 'On hold', 'Completed'];
var PROJECT_FIELDS = [
  ['Project name', 'name'],
  ['Client name', 'client'],
  ['Start date', 'startDate'],
  ['Deadline', 'deadline'],
  ['Status', 'status'],
  ['Summary', 'summary']
];

function doGet(e) {
  var key = (e && e.parameter && e.parameter.k) || '';
  if (!isValidKey_(key)) return json_({ ok: false, error: 'unauthorized' });
  try {
    return json_({ ok: true, data: readData_(SpreadsheetApp.getActiveSpreadsheet()) });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server_error' });
  }
}

function isValidKey_(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');
  return !!expected && typeof key === 'string' && key === expected;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function readData_(ss) {
  var tz = ss.getSpreadsheetTimeZone();
  var lastEdit = PropertiesService.getScriptProperties().getProperty('LAST_EDIT');
  return {
    project: readProject_(ss.getSheetByName(SHEETS.project), tz),
    tasks: readRows_(ss.getSheetByName(SHEETS.tasks), ['task', 'status', 'dueDate', 'note'], tz),
    updates: readRows_(ss.getSheetByName(SHEETS.updates), ['date', 'message'], tz),
    lastUpdated: lastEdit || null
  };
}

// Project tab is two columns: label | value.
function readProject_(sheet, tz) {
  var project = {};
  if (!sheet) return project;
  var lookup = {};
  PROJECT_FIELDS.forEach(function (f) { lookup[f[0].toLowerCase()] = f[1]; });
  sheet.getDataRange().getValues().forEach(function (row) {
    var field = lookup[String(row[0]).trim().toLowerCase()];
    if (field) project[field] = cell_(row[1], tz);
  });
  return project;
}

// Row tabs: first row is a header, columns map to `fields` in order. Blank rows are skipped.
function readRows_(sheet, fields, tz) {
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues().slice(1);
  return values
    .filter(function (row) { return row.some(function (v) { return v !== '' && v !== null; }); })
    .map(function (row) {
      var item = {};
      fields.forEach(function (f, i) { item[f] = cell_(row[i], tz); });
      return item;
    });
}

function cell_(value, tz) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    // Check the time in the sheet's zone; the script's own zone can differ.
    var hasTime = Utilities.formatDate(value, tz, 'HH:mm:ss') !== '00:00:00';
    return Utilities.formatDate(value, tz, hasTime ? "yyyy-MM-dd'T'HH:mm:ssXXX" : 'yyyy-MM-dd');
  }
  if (value === null || value === undefined) return '';
  return typeof value === 'string' ? value.trim() : String(value);
}

// Simple trigger: remembers when the sheet was last changed, shown as "Last updated" on the page.
function onEdit() {
  PropertiesService.getScriptProperties().setProperty('LAST_EDIT', new Date().toISOString());
}

function setupSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var today = addDays_(new Date(), 0);

  var project = getOrCreate_(ss, SHEETS.project);
  if (project.getLastRow() === 0) {
    var rows = PROJECT_FIELDS.map(function (f) { return [f[0], '']; });
    rows[0][1] = 'My Project';
    rows[1][1] = 'Client Name';
    rows[2][1] = today;
    rows[3][1] = addDays_(today, 30);
    rows[4][1] = 'On track';
    rows[5][1] = 'Short description of what is being built.';
    project.getRange(1, 1, rows.length, 2).setValues(rows);
    project.getRange(1, 1, rows.length, 1).setFontWeight('bold').setBackground('#eef2ff');
    project.getRange(3, 2, 2, 1).setNumberFormat('dd mmm yyyy');
    project.setColumnWidth(1, 140);
    project.setColumnWidth(2, 420);
  }
  project.getRange(5, 2).setDataValidation(listRule_(PROJECT_STATUSES));

  var tasks = getOrCreate_(ss, SHEETS.tasks);
  if (tasks.getLastRow() === 0) {
    tasks.getRange(1, 1, 1, 4).setValues([['Task', 'Status', 'Due date', 'Note (visible to client)']]);
    tasks.getRange(2, 1, 3, 4).setValues([
      ['Planning', 'Done', addDays_(today, -2), ''],
      ['Design', 'In progress', addDays_(today, 7), ''],
      ['Development', 'To do', addDays_(today, 20), '']
    ]);
    styleHeader_(tasks, 4);
    tasks.setColumnWidth(1, 260);
    tasks.setColumnWidth(4, 320);
  }
  tasks.getRange('B2:B').setDataValidation(listRule_(TASK_STATUSES));
  tasks.getRange('C2:C').setNumberFormat('dd mmm yyyy');

  var updates = getOrCreate_(ss, SHEETS.updates);
  if (updates.getLastRow() === 0) {
    updates.getRange(1, 1, 1, 2).setValues([['Date', 'Update message']]);
    updates.getRange(2, 1, 1, 2).setValues([[today, 'Project started.']]);
    styleHeader_(updates, 2);
    updates.setColumnWidth(2, 520);
  }
  updates.getRange('A2:A').setNumberFormat('dd mmm yyyy');

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ACCESS_KEY')) props.setProperty('ACCESS_KEY', newKey_());
  onEdit();
  showClientLink();
}

// Prints the secret key. Link format: https://<github-user>.github.io/client-status/?k=KEY
function showClientLink() {
  var key = PropertiesService.getScriptProperties().getProperty('ACCESS_KEY');
  var msg = 'Secret key: ' + key + '\n\nClient link: https://rinshidvp.github.io/client-status/?k=' + key;
  console.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* not opened from the sheet UI */ }
}

// Makes a new key; the old client link stops working immediately.
function rotateKey() {
  PropertiesService.getScriptProperties().setProperty('ACCESS_KEY', newKey_());
  showClientLink();
}

function newKey_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
}

function getOrCreate_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function listRule_(values) {
  return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
}

function styleHeader_(sheet, cols) {
  sheet.getRange(1, 1, 1, cols).setFontWeight('bold').setBackground('#eef2ff');
  sheet.setFrozenRows(1);
}

function addDays_(date, n) {
  var d = new Date(date.getTime());
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Client Status')
    .addItem('Show client link', 'showClientLink')
    .addItem('Set up / repair tabs', 'setupSheet')
    .addItem('Make new link (old one stops working)', 'rotateKey')
    .addToUi();
}
