(function (Balanced) {
    'use strict';

    /*
     * Like a regular serializer but because we do *not* have a root level
     * element this thing jumps in and munges the payload.
     *
     * http://emberjs.com/guides/models/the-rest-adapter/#toc_json-root
     *
     * TODO: We need to serialize into the root level dict as well as loading
     * from it
     * */
    var rootLevelSerializer = DS.JSONSerializer.create({
        extract: function (loader, json, type, record) {
            var root = this.rootForType(type);
            var nestedJson = {};
            nestedJson[root] = json;

            this.sideload(loader, type, nestedJson, root);
            this.extractMeta(loader, type, nestedJson);

            if (nestedJson) {
                if (record) {
                    loader.updateId(record, nestedJson[root]);
                }
                this.extractRecordRepresentation(loader, type, nestedJson[root]);
            }
        },
        extractMany: function (loader, json, type, records) {
            var root = 'items';
            this.extractMeta(loader, type, json);
            var objects = json[root] ? json[root] : json;
            if (objects) {
                var references = [];
                if (records) {
                    records = records.toArray();
                }

                for (var i = 0; i < objects.length; i++) {
                    if (records) {
                        loader.updateId(records[i], objects[i]);
                    }
                    var reference = this.extractRecordRepresentation(loader, type, objects[i]);
                    references.push(reference);
                }

                loader.populateArray(references);
            }
        }
    });


    var balancedAdapter = Auth.RESTAdapter.extend({
        serializer: rootLevelSerializer,
        createRecord: function (store, type, record) {
            var root = this.rootForType(type);
            var data = this.serialize(record, { includeId: true });

            this.ajax(this.buildURL(root), "POST", {
                data: data,
                context: this,
                success: function (json) {
                    Ember.run(this, function () {
                        this.didCreateRecord(store, type, record, json);
                    });
                },
                error: function (xhr) {
                    this.didError(store, type, record, xhr);
                }
            });
        },
        updateRecord: function (store, type, record) {
            var id = Ember.get(record, 'id');
            var root = this.rootForType(type);
            var data = this.serialize(record);

            this.ajax(this.buildURL(root, id), "PUT", {
                data: data,
                context: this,
                success: function (json) {
                    Ember.run(this, function () {
                        this.didSaveRecord(store, type, record, json);
                    });
                },
                error: function (xhr) {
                    this.didError(store, type, record, xhr);
                }
            });
        },
        // since our API doesn't support params with search criteria, iterate and issue requests for each
        findMany: function(store, type, ids, owner) {
            for(var i = 0; i < ids.length; i++) {
                this.find(store, type, ids[i]);
            }
        },
    });

    Balanced.Store = DS.Store.extend({
        revision: 12,
        adapter: balancedAdapter.extend({
            url: Ember.ENV.BALANCED.API,
            namespace: "v1",
        })
    });

    var userAdapter = balancedAdapter.extend({
        url: ENV.BALANCED.AUTH
    });
    userAdapter.map('Balanced.User', {
      marketplaces: { embedded: 'always' }
    });
    Balanced.Store.registerAdapter('Balanced.User', userAdapter);

})(window.Balanced);
