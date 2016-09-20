/**
 * @author narayanu
 * 
 * summary:
 *      various tools for dom manipulation
 *
 */

define(["dojo/_base/declare", "dojo/dom", "dojo/dom-construct", "dojo/dom-attr", "dojo/dom-style", "mapper/utils/MakeSingleton"], 
function(declare, dom, domConstruct, domAttr, domStyle, MakeSingleton) {
  
  function getUID() {
    return "xxxx-xxxx-xxxx-xxxx".replace(/x/g, function() {
        return (Math.floor((Math.random() * 16))).toString(16); 
    });
  }
  
  var domTools = declare("mapper.utils.dom-tools", [], {
    constructor: function(){},
    
    //summary:
    //      getNodeWithUniqueId will accept elementType (eg. "div", "a", "img") and referenceElement
    //      will create a new dom node of type elementType and insert it inside referenceElement
    createNodeWithUniqueId: function(elementType, referenceElement, placementOption) {
        var referenceNode = dom.byId(referenceElement);
        var node = domConstruct.create(elementType, {}, referenceNode, placementOption);
        return domAttr.set(node, "id", getUID());
    },
    
    setStyle: function(node, attr, style) {
       domStyle.set(node, attr, style);  
    },
    
    setStyles: function(node, styles) {
        for (attr in styles) {
            if (styles.hasOwnProperty(attr)) {
                domStyle.set(node, attr, styles[attr]);       
            }
        }
    },
    
    setNodeId: function(node) {
        domAttr.set(node, "id", getUID());
    },
    
    getStyle: function(node, style) {
       return domStyle.get(node, style);
    }
  
  });
  
  return MakeSingleton(domTools);
  
});
