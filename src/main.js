/**
 * @author narayanu
 */

require([
    "dojo/parser",
    "mapper/AppController",
    "dijit/layout/BorderContainer",
    "dijit/layout/ContentPane",
    "dojo/domReady!"],
    
    function(parser, AppController) {
        var parseDeferred = parser.parse();
        if (parseDeferred) {
            parseDeferred.then(function(){
                var appController = new AppController("mapper/config.json");
                appController.init();   
            });    
        }
    });
