/* global QUnit */
// https://api.qunitjs.com/config/autostart/
QUnit.config.autostart = false;

sap.ui.require([
	"ui5onpremise/ui5-onpremise/test/unit/AllTests"
], function (Controller) {
	"use strict";
	QUnit.start();
});