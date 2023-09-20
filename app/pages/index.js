"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable react-hooks/exhaustive-deps, @next/next/no-img-element */
// --- Methods
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
// -- Pages
var Home_1 = require("./Home");
var Welcome_1 = require("./Welcome");
var Dashboard_1 = require("./Dashboard");
var privacy_1 = require("./privacy");
var Maintenance_1 = require("./Maintenance");
// -- Datadog
var browser_rum_1 = require("@datadog/browser-rum");
var browser_logs_1 = require("@datadog/browser-logs");
var helpers_1 = require("../utils/helpers");
browser_rum_1.datadogRum.init({
    applicationId: process.env.NEXT_PUBLIC_DATADOG_APPLICATION_ID || "",
    clientToken: process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN || "",
    site: "datadoghq.eu",
    service: "passport-frontend",
    env: process.env.NEXT_PUBLIC_DATADOG_ENV || "",
    // Specify a version number to identify the deployed version of your application in Datadog
    // version: '1.0.0',
    sampleRate: 100,
    premiumSampleRate: 0,
    trackInteractions: true,
    defaultPrivacyLevel: "mask-user-input",
});
browser_logs_1.datadogLogs.init({
    clientToken: process.env.NEXT_PUBLIC_DATADOG_CLIENT_TOKEN || "",
    site: "datadoghq.eu",
    forwardErrorsToLogs: true,
    sampleRate: 100,
    service: "passport-frontend",
    env: process.env.NEXT_PUBLIC_DATADOG_ENV || "",
});
var App = function () {
    if ((0, helpers_1.isServerOnMaintenance)()) {
        return <Maintenance_1.default />;
    }
    return (<div>
      <react_router_dom_1.HashRouter>
        <react_router_dom_1.Routes>
          <react_router_dom_1.Route path="/" element={<Home_1.default />}/>
          <react_router_dom_1.Route path="/welcome" element={<Welcome_1.default />}/>
          <react_router_dom_1.Route path="/dashboard" element={<Dashboard_1.default />}/>
          <react_router_dom_1.Route path="/privacy" element={<privacy_1.default />}/>
        </react_router_dom_1.Routes>
      </react_router_dom_1.HashRouter>
    </div>);
};
exports.default = App;
