define([
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/on",
    "dojo/dom-construct",
    "dojo/dom-class",
    "dijit/registry",
    "dijit/Tree",
    "dijit/_TemplatedMixin",
    "dijit/_WidgetsInTemplateMixin",
    "dojo/text!mapper/widgets/templates/TocTreeNodeTmpl.html",
    "dijit/form/CheckBox"
    ], function(declare, lang, on, domConstruct, domClass, registry, Tree, _TemplatedMixin, _WidgetsInTemplateMixin, 
        tocTreeNodeTmpl) {
    
    var _clickAll = function(node, checked) {
        node.item.visibility = checked;
        if (node.item.hasSubLayers) {
            var children = node.getChildren();
            for (var i = 0, il = children.length; i < il; i++) {
                var child = children[i];
                child.visibNode.set('checked', checked);
                _clickAll(child, checked);
            }
        }
    };

    return declare('mapper.widgets._TocTreeNode', [Tree._TreeNode, _TemplatedMixin, _WidgetsInTemplateMixin], {
        
        "disabled": false,
        
        //"expandable": true,
        
        "legend": null,
        
        "visibility": false,
        
        templateString: tocTreeNodeTmpl,
        
        widgetsInTemplate: true,

        constructor: function(args) {
            var opts = {
                "disabled": args.item.disabled,
                //"expandable": args.item.expandable,
                "legend": args.item.legend,
                "visibility": args.item.visibility
            };
            lang.mixin(this, opts);
        },
        
        _setVisibilityAttr: function(visib) {
            this._set("visibility", visib);
            this.visibNode.set('checked', visib);        
        },
        
        _setDisabledAttr: function(disabled) {
            this._set("disabled", disabled);
            this.visibNode.set('disabled', disabled);
            domClass.replace(this.labelNode, this.item.disabled ? 'text-disabled' : 'text-enabled', 
                 this.item.disabled ? 'text-enabled' : 'text-disabled');
        },
        /*
        _setExapandableAttr: function(expandable) {
            this._set("expandable", expandable);
            if (!expandable) {
                var remove = ["dijitTreeExpando", "dijitTreeExpandoClosed"];
                domClass.replace(this.expandoNode, "dijitTreeExpandoReplacer", remove);
            }
        },
       */
        _setLegendAttr: function(arr) {
            this._set("legend", arr);
            if (arr) {
                if (arr.length == 1) {
                     var item = arr[0];
                     var htm = "<div class='legend-item'>" + 
                                "<img src='data:" + item.contentType + ";base64," + item.imageData + "'/>" +
                                "<span>" + item.label.replace(/<|>/g, "") + "</span></div>";
                     var lNode = domConstruct.toDom(htm);
                     domConstruct.place(lNode, this.symbolNode, 'last');
                     
                } else if (arr.length > 1) {
                    var html = "<ul class='legend'>";
                    for (var i=0, il=arr.length; i<il; i++) {
                        var item = arr[i];
                        html += "<li class='legend-item'>" + 
                            "<img src='data:" + item.contentType + ";base64," + item.imageData + "'/>" +
                            "<span>" + item.label.replace(/<|>/g, "") + "</span></li>";
                    };
                    
                    html += '</ul>';
                    var lNode = domConstruct.toDom(html);
                    domConstruct.place(lNode, this.containerNode, 'last');
                 }
            }
            else {
                if (this.item.parentLayerId != -2) {
                    var lNode = domConstruct.toDom("<div class='legend-item'><div class='dijitIcon dijitFolderClosed'></div></div>");
                    domConstruct.place(lNode, this.symbolNode, 'last');
                }
            }
        },
        
        postCreate: function() {
            this.inherited(arguments);
            //when treenode is changed emit an event for 
            //parent toc to listen to
            var self=this;
            this.visibNode.on("click", function(event) {
                var checkState = event.target.checked;
                self.item.visibility = checkState;
                event.stopPropagation();
                
                _clickAll(self, checkState);
            	self.emit("visibility-changed", {
                   bubbles: true,
                   cancelable : true,
                   visible: checkState
                });
            });
        },
        
        startup: function() {
            this.inherited(arguments);
        }
    });
});