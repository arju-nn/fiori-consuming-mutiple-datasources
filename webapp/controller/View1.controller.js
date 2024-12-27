sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Input",
    "sap/m/VBox",
    "sap/m/Label",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/DatePicker"
], function (Controller, MessageToast, Dialog, Button, Input, VBox, Label, JSONModel, MessageBox, DatePicker) {
    "use strict";

    return Controller.extend("ui5onpremise.ui5onpremise.controller.View1", {
        onInit: function () {
            // Models for Table 1 and Table 2
            this.localModel = new JSONModel({
                AssetName: "",
                ServiceCentreName: "",
                CustodianName: "",
                TransactionId: "",
                AssetId: ""
            });

            this.localModel2 = new JSONModel({
                Empid: "",
                Name: "",
                Age: "",
                Email: ""
            });

            this.localModel3 = new JSONModel({
                invoice_id: "",
                customer: "",
                total_amount: "",
                created_date: "",
                status: ""
            });

            this.getView().setModel(this.localModel, "form");
            this.getView().setModel(this.localModel2, "form2");
            this.getView().setModel(this.localModel3, "form3");

            this.tableModel = new JSONModel([]);
            this.tableModel2 = new JSONModel([]);
            this.tableModel3 = new JSONModel([]);

            this.getView().setModel(this.tableModel, "table");
            this.getView().setModel(this.tableModel2, "table2");
            this.getView().setModel(this.tableModel3, "table3");

            this.csrfToken = null; // CSRF Token

            // Load data for both tables
            this.loadTableData(0);
            this.loadTable2Data(0);
            this.loadTable3Data(0);
        },

        fetchCsrfToken: function () {
            const oModel = this.getOwnerComponent().getModel();
            return new Promise((resolve, reject) => {
                oModel.refreshSecurityToken(
                    () => {
                        this.csrfToken = oModel.getSecurityToken();
                        resolve(this.csrfToken);
                    },
                    (error) => reject(error)
                );
            });
        },

        loadTableData: function (skip) {
            const oModel = this.getOwnerComponent().getModel();
            oModel.read("/FITESTSet", {
                urlParameters: { "$top": 15, "$skip": skip },
                success: (data) => {
                    console.log('Loaded asset data: ', data);

                    return this.tableModel.setData(data.results || [])
                },
                error: () => MessageToast.show("Error fetching Table 1 data")
            });
        },

        onAddNew: function () {
            this.localModel.setData({
                AssetName: "",
                ServiceCentreName: "",
                CustodianName: "",
                TransactionId: "",
                AssetId: ""
            });
            this.openDialog("Add New Item");
        },

        openDialog: function (title) {
            if (!this.dialog) {
                this.dialog = new Dialog({
                    title: title,
                    content: new VBox({
                        items: [
                            new Label({ text: "Asset Name" }),
                            new Input({ value: "{form>/AssetName}" }),
                            new Label({ text: "Service Centre Name" }),
                            new Input({ value: "{form>/ServiceCentreName}" }),
                            new Label({ text: "Custodian Name" }),
                            new Input({ value: "{form>/CustodianName}" })
                        ],
                    }).addStyleClass("dialogContentPadding"),
                    beginButton: new Button({
                        text: "Save",
                        press: this.onSave.bind(this),
                        type: "Accept"
                    }),
                    endButton: new Button({
                        text: "Cancel",
                        press: () => this.dialog.close(),
                        type: "Reject"
                    }),
                });
                this.getView().addDependent(this.dialog);
            }
            this.dialog.setTitle(title);
            this.dialog.open();
        },

        onEdit: function (oEvent) {
            const item = oEvent.getSource().getBindingContext("table").getObject();
            this.localModel.setData(item);
            this.openDialog("Edit Item");
        },

        onDelete: async function (oEvent) {
            const item = oEvent.getSource().getBindingContext("table").getObject();
            const oModel = this.getOwnerComponent().getModel();
            const path = `/FITESTSet(TransactionId='${item.TransactionId}',Mandt='100')`;
            console.log('this.csrfToken: ', this.csrfToken);

            try {
                await this.fetchCsrfToken();
                oModel.remove(path, {
                    headers: { "X-CSRF-Token": this.csrfToken },
                    success: () => {
                        MessageToast.show("Deleted successfully");
                        this.loadTableData(0);
                    },
                    error: () => MessageToast.show("Error deleting item")
                });
            } catch (error) {
                MessageToast.show("Error fetching CSRF token");
            }
        },

        generateCustomId: async function (prefix = "TX") {
            const timestamp = new Date().getTime();
            console.log('timestamp: ', timestamp);
            return `${prefix}-${timestamp}`;
        },

        formatODataDate: function (date) {
            if (!date) return "/Date(0)/"; // Default to an epoch date if no date is provided
            return `/Date(${new Date(date).getTime()})/`;
        },

        onSave: async function () {
            const oModel = this.getOwnerComponent().getModel();
            const formData = this.localModel.getData();
            const isEdit = !!formData.TransactionId;

            try {
                const transactionId = isEdit ? formData.TransactionId : await this.generateCustomId("TX");
                const assetId = isEdit ? formData.AssetId : await this.generateCustomId("AS");

                // Prepare the payload
                const payload = {
                    ...formData,
                    AssetId: assetId,
                    TransactionId: transactionId,
                    TransactionDate: this.formatODataDate(new Date()),
                    CreatedDate: this.formatODataDate(new Date()),
                    EndDate: this.formatODataDate(new Date()),
                };

                // Ensure CSRF token is fetched
                await this.fetchCsrfToken();

                const method = isEdit ? "update" : "create";
                const url = isEdit
                    ? `/FITESTSet(TransactionId='${transactionId}',Mandt='100')`
                    : "/FITESTSet";

                // Execute the OData operation
                if (method === "create") {
                    oModel.create(url, payload, {
                        headers: { "X-CSRF-Token": this.csrfToken },
                        success: () => {
                            MessageToast.show("Created successfully");
                            this.dialog.close();
                            this.loadTableData(0);
                        },
                        error: (err) => {
                            console.error("Error during create: ", err);
                            MessageToast.show("Error saving item");
                        },
                    });
                } else if (method === "update") {
                    oModel.update(url, payload, {
                        headers: { "X-CSRF-Token": this.csrfToken },
                        success: () => {
                            MessageToast.show("Updated successfully");
                            this.dialog.close();
                            this.loadTableData(0);
                        },
                        error: (err) => {
                            console.error("Error during update: ", err);
                            MessageToast.show("Error saving item");
                        },
                    });
                }
            } catch (error) {
                console.error("Error in onSave: ", error);
                MessageToast.show("An error occurred");
            }
        },

        loadTable2Data: function (skip) {
            const oModel = this.getOwnerComponent().getModel("s2");
            oModel.read("/ZENT_EMP_DETAILSSet", {
                urlParameters: { "$top": 15, "$skip": skip },
                success: (data) => {
                    console.log('data 2: ', data);
                    this.tableModel2.setData(data.results || []);
                },
                error: (error) => MessageToast.show("Error fetching data")
            });
        },

        // Table 2 - Add New Item
        onAddNew2: function () {
            this.localModel2.setData({
                Empid: "",
                Name: "",
                Age: "",
                Email: ""
            });
            this.openDialog2("Add New Employee Data");
        },

        openDialog2: function (title) {
            if (!this.dialog2) {
                this.dialog2 = new Dialog({
                    title: title,
                    content: new VBox({
                        items: [
                            new Label({ text: "Name" }),
                            new Input({ value: "{form2>/Name}" }),
                            new Label({ text: "Age" }),
                            new Input({ value: "{form2>/Age}", type: "Number" }),
                            new Label({ text: "Email" }),
                            new Input({ value: "{form2>/Email}" }),
                        ],
                    }).addStyleClass("dialogContentPadding"),
                    beginButton: new Button({
                        text: "Save",
                        press: this.onSave2.bind(this),
                        type: "Accept"
                    }),
                    endButton: new Button({
                        text: "Cancel",
                        press: () => this.dialog2.close(),
                        type: "Reject"
                    }),
                });
                this.getView().addDependent(this.dialog2);
            }
            this.dialog2.setTitle(title);
            this.dialog2.open();
        },

        // Table 2 - Edit Item
        onEdit2: function (oEvent) {
            const item = oEvent.getSource().getBindingContext("table2").getObject();
            this.localModel2.setData(item);
            this.openDialog2("Edit Employee Data");
        },

        // Table 2 - Delete Item
        onDelete2: async function (oEvent) {
            const item = oEvent.getSource().getBindingContext("table2").getObject();
            const oModel = this.getOwnerComponent().getModel("s2");
            const path = `/ZENT_EMP_DETAILSSet(Empid='${item.Empid}')`;

            try {
                await this.fetchCsrfToken();
                oModel.remove(path, {
                    headers: { "X-CSRF-Token": this.csrfToken },
                    success: () => {
                        MessageToast.show("Deleted successfully");
                        this.loadTable2Data(0);
                    },
                    error: () => MessageToast.show("Error deleting item")
                });
            } catch (error) {
                MessageToast.show("Error fetching CSRF token");
            }
        },

        // Table 2 - Save Item

        onSave2: async function () {
            const oModel = this.getOwnerComponent().getModel("s2");
            const formData = this.localModel2.getData();
            const isEdit = !!formData.Empid;

            try {
                const empid = isEdit ? formData.Empid : "EMP-12"

                // Prepare the payload
                const payload = {
                    ...formData,
                    Empid: empid,
                    CreatedDt: this.formatODataDate(new Date()),
                    Doj: new Date()
                };

                // Ensure CSRF token is fetched
                await this.fetchCsrfToken();

                const method = isEdit ? "update" : "create";
                const url = isEdit
                    ? `/ZENT_EMP_DETAILSSet(Empid='${formData.Empid}')`
                    : "/ZENT_EMP_DETAILSSet";

                // Execute the OData operation
                if (method === "create") {
                    oModel.create(url, payload, {
                        headers: { "X-CSRF-Token": this.csrfToken },
                        success: () => {
                            console.log('payload: ', payload);
                            MessageToast.show("Created successfully");
                            this.dialog2.close();
                            this.loadTable2Data(0);
                        },
                        error: (err) => {
                            console.error("Error during create: ", err);
                            MessageToast.show("Error saving item");
                        },
                    });
                } else if (method === "update") {
                    oModel.update(url, payload, {
                        headers: { "X-CSRF-Token": this.csrfToken },
                        success: () => {
                            MessageToast.show("Updated successfully");
                            this.dialog2.close();
                            this.loadTable2Data(0);
                        },
                        error: (err) => {
                            console.error("Error during update: ", err);
                            MessageToast.show("Error saving item");
                        },
                    });
                }
            } catch (error) {
                console.error("Error in onSave: ", error);
                MessageToast.show("An error occurred");
            }
        },

        loadTable3Data: function (skip) {
            const oModel = this.getOwnerComponent().getModel("invoices");
            const oBinding = oModel.bindList("/Invoice", {
                $skip: skip,
                $top: 15
            });

            oBinding.requestContexts()
                .then((aContexts) => {
                    this.tableModel3.setData(aContexts.map((oContext) => oContext.getObject()) || []);
                })
                .catch((oError) => {
                    console.error("Error loading Invoice data: ", oError);
                    MessageToast.show("Error fetching Invoice data");
                });
        },

        onAddNew3: function () {
            this.localModel3.setData({
                invoice_id: "",
                customer: "",
                total_amount: "",
                created_date: "",
                status: ""
            });
            this.openDialog3("Add New Invoice");
        },

        openDialog3: function (title) {
            if (!this.dialog3) {
                this.dialog3 = new Dialog({
                    title: title,
                    content: new VBox({
                        items: [
                            new Label({ text: "Customer Name" }),
                            new Input({ value: "{form3>/customer}" }),
                            new Label({ text: "Amount" }),
                            new Input({ value: "{form3>/total_amount}", type: "Number" }), // Amount input as number
                            new Label({ text: "Invoice Date" }),
                            new DatePicker({ value: "{form3>/created_date}" }), // DatePicker for Invoice Date
                            new Label({ text: "Status" }),
                            new Input({ value: "{form3>/status}" })
                        ]
                    }).addStyleClass("dialogContentPadding"),
                    beginButton: new Button({
                        text: "Save",
                        press: this.onSave3.bind(this),
                        type: "Accept"
                    }),
                    endButton: new Button({
                        text: "Cancel",
                        press: () => this.dialog3.close(),
                        type: "Reject"
                    })
                });
                this.getView().addDependent(this.dialog3);
            }
            this.dialog3.setTitle(title);
            this.dialog3.open();
        },

        // Table 2 - Edit Item
        onEdit3: function (oEvent) {
            const item = oEvent.getSource().getBindingContext("table3").getObject();
            this.localModel3.setData(item);
            this.openDialog3("Edit Invoices Order");
        },

        onDelete3: async function (oEvent) {
            const oModel = this.getOwnerComponent().getModel("invoices");
            const item = oEvent.getSource().getBindingContext("table3").getObject();
            console.log('item: ', item);
            const path = `/Invoice(${item.invoice_id})`;

            let oBindList = oModel.bindList("/Invoice");
            var that = this;
            let aFilter = new sap.ui.model.Filter("invoice_id", sap.ui.model.FilterOperator.EQ, item.invoice_id);

            try {
                oBindList.filter(aFilter).requestContexts().then(function (aContexts) {
                    aContexts[0].delete();
                    MessageBox.success("Invoice deleted successfully");
                    that.loadTable3Data(0);

                });
            } catch (error) {
                console.error("Error deleting Invoice: ", error);
                MessageToast.show("Error deleting Invoice");
            }
        },


        onSave3: async function () {
            const oModel = this.getOwnerComponent().getModel("invoices"); // Ensure this is an OData V4 model
            const formData = this.localModel3.getData();
            const isEdit = !!formData.invoice_id; // Check if this is an edit operation

            // Utility function to format dates for OData
            const formatODataDate = (date) => {
                if (!date) return null;

                // Convert the date string into a Date object if it's a string
                const d = new Date(date);

                // If the date is invalid, return null
                if (isNaN(d)) return null;

                // Use DateFormat to format the date in OData compatible format (YYYY-MM-DD)
                const oDateFormat = DateFormat.getInstance({ pattern: "yyyy-MM-dd" });
                return oDateFormat.format(d);
            };

            // Format the date field
            formData.created_date = formatODataDate(formData.created_date);

            let oBindList = oModel.bindList("/Invoice");
            try {
                if (isEdit) {

                    var currentAsset;
                    var that = this;
                    oBindList.requestContexts().then(function (aContexts) {
                        aContexts.forEach(oContext => {
                            console.log("Assetsss", oContext.getObject());
                            console.log('formData: ', formData);
                            if (oContext.getObject().invoice_id == formData.invoice_id) {
                                currentAsset = oContext.getObject();

                                console.log('currentAsset: ', currentAsset);

                                var oData = currentAsset;
                                console.log('oData: ', oData);
                                // Update operation
                                oContext.setProperty("customer", formData.customer);
                                oContext.setProperty("total_amount", formData.total_amount);
                                oContext.setProperty("status", formData.status);
                                oContext.setProperty("created_date", formData.created_date);
                                that.localModel3.setData(oData);

                                // await oModel.submitBatch("invoiceUpdateGroup"); // Submit the batch update
                                MessageToast.show("Invoice updated successfully");
                                that.dialog3.close();
                                that.loadTable3Data(0);
                            }
                        })
                    })
                    MessageToast.show("Invoice updated successfully");

                } else {
                    // Create operation
                    delete formData.invoice_id; // Ensure no ID is set for creation
                    const oBinding = oModel.bindList("/Invoice");
                    oBinding.create(formData, false); // Second parameter determines whether it is deferred
                    MessageBox.success("Invoice created successfully");
                }

                // Close the dialog and refresh the table
                this.dialog3.close();
                this.loadTable3Data(0); // Reload data to reflect changes
            } catch (error) {
                console.error("Error saving Invoice: ", error);
                MessageBox.error("Failed to save Invoice. Please try again.");
            }
        },

    });
});
