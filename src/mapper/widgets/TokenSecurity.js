/**
 * @author narayanu
 * 
 * summary:
 *      TokenSecurity will check whether the requested URL needs authentication. If yes and the 
 *      url has not been already checked before the user is presented with a dialog to input 
 *      credentials. Once a token has been obtained, it is saved and automatically appended to 
 *      the url
 */

define(["dojo/_base/declare", "dijit/Dialog", "dojo/request/script", "dojo/Deferred", "mapper/utils/MakeSingleton",
"dojo/text!mapper/widgets/templates/TokenDialogTmpl.html", "dijit/form/Form", 
    "dijit/form/TextBox", 
    "dijit/form/Button", "dojo/request/script", "dojo/request"], 
        
        function(declare, Dialog, script, Deferred, MakeSingleton, TokenDialogTmpl, Form, TextBox, Button, script, request) {
    
    var _token=null, _dialog=null;
    
    var TokenSecurity = declare("mapper.widgets.TokenSecurity", [], {
        
        constructor: function(opts) {
            this.tokenAuthUrl = "http://cmvpdev:6080/arcgis/tokens/";
            this.checkedUrls = {};
        },
        
        checkTokenRequired: function(url) {
            //get everything to the left of http://server.com/arcgis/rest/services/folder/subfolder/service/MapServer/layerId
            //and see if we have already tested this service for token auth requirement
            var serviceUrl = url.split("MapServer")[0];
            var urlHash = this._generateUrlHash(serviceUrl);
            var def = new Deferred();
            var self = this;
            
            if (!this.checkedUrls.hasOwnProperty(urlHash)) {
                script.get(serviceUrl + "MapServer?f=json", {
                    jsonp: "callback"
                   }).then(function(data) {
                    if (data.hasOwnProperty('error')) {
                        //token is required
                        if (data.error.code == 499) {
                           def.resolve(true);
                        }
                    }
                    else {
                        def.resolve(false);                        
                    }
                   }, function(error) {
                       def.reject(error);
                });
                
            } else {
                def.resolve(true);
            }
            
            return def;
        },

        //create a dialog and get username, password.
        requestCredentials: function() {
            var def = new Deferred();
            var form = new Form();

            var tbLogin = new TextBox({
                placeHolder: "Login"
            }).placeAt(form.containerNode);
        
            var tbPassword = new TextBox({
                placeHolder: "Password"
            }).placeAt(form.containerNode);
        
            var self = this;
            
            new Button({
              label: "Get Token",
              
              onClick: function() {
                  var login = tbLogin.value;
                  var password = tbPassword.value;
                  
                  self._generateToken(login, password).then(
                      function(token) {
                          def.resolve(token);
                      }, 
                      function(error) {
                          def.reject(error);
                      }
                  );  
              }
            }).placeAt(form.containerNode);

            _dialog = new Dialog({
                onCancel: function() {
                  alert('You are closing this dialog');
                  def.reject();
                }
            });
            
            _dialog.set('content', form);
            _dialog.set('title', "Token Authentication");
            
            form.startup();
            _dialog.show();
            
            return def;
        },
                    
        _generateUrlHash: function(str) {
            var hash=0, chr;
            for (var i=0, il=str.length; i<il; i++) {
             chr = str.charCodeAt(i);
             hash = ((hash << 31) - hash) + chr;
             hash |= 0;   
            }
            
            return hash;
        },
        
        _generateToken: function(usr, pwd) {
            var def = new Deferred();
            
            esri.request({
                url: "https://servicesbeta.esri.com/ArcGIS/tokens",
                content: {
                  request: "getToken",
                  username: usr,
                  password: pwd
                },
                handleAs: "text",
                
                load: function(token) {
                    def.resolve(token);
                },
                
                error: function(error) {
                    def.reject(error);
                }
            });

            return def;
        }
    });

    return MakeSingleton(TokenSecurity);
});
