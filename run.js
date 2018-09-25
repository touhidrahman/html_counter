var fs = require('fs');
var rp = require('request-promise');
const cheerio = require('cheerio');
const cssbeautify = require('cssbeautify');

// Save the url name from command
var url = process.argv.slice(2)[0];


var options = {
    uri: url,
    transform: function (body) {
        return cheerio.load(body);
    }
};

// Object for storing result
var dom = {};
var level = {};
var level_c =[]
var css = {};
var css_c = [];
var item;

console.log("Fetching HTML File...")
rp(options)
    .then(function ($) {
        function addToDom(name) {
            if (name in dom){
                dom[name] = dom[name] + 1
            } else {
                dom[name] = 1
            }
        }

        function addDepth(depth, count) {
            if (depth in level){
                // update level if it is greater than previous depth
                if (level[depth] < count) {
                level[depth] = count
                }
            } else {
                level[depth] = count
            }
        }

        function traverseDOM(child, depth) {
        let count = 0;
        for (let i = 0; i<child.length; i++) {
            if (child[i].type == 'tag') {
            count++;
            name = child[i].name
            addToDom(name)
            if (child[i].children.length > 1) {
                let temp = parseInt(depth) + 1
                traverseDOM(child[i].children, temp.toString())
                }
            } else {
                continue
            }
        }
        addDepth(depth, count)
        }

        console.log("Parsing the DOM...")
        traverseDOM($('html').children(), "1");

        // Calling method for css sylesheets
        getCSS($);
    })
    .catch(function (err) {
        // Crawling failed or Cheerio choked...
        if (err.name == "RequestError" )
            console.log("Failed to fetch url!")
        else 
            console.log("Something went wrong!")
    });


function getCSS($) {
    console.log("Successfully parsed the DOM.");
    console.log("Fetching CSS Files...");
    
    let links = $('link[rel=stylesheet]');
    let href = [], link;
    let cssName = [];
    
    for (let i = 0; i < links.length; i++) {
        link = links[i].attribs.href;
        // If href of <link> contains local file name
        if ( link.includes("http") == false ) {
            link = url+ "/" +link
        }
        cssName.push(link);
        
        // Fetching css files and its results
        href.push( rp(link)
                .catch( function (err) { 
                    console.log("Unable to fetch this CSS link: " + link)
                }) 
            );
    }

    // Using JavaScript Promise 
    // request fetches links asynchronously 
    // Promise get all asychronous results and then proceeds to next
    Promise.all(href)
        .then(function (results) {
            let line;
            results.map(function(data, index) {
                    if (typeof(data) == "string") {
                        data = cssbeautify(data);
                        // remove empty lines
                        data = data.replace(/(^[ \t]*\n)/gm, "");
                        //count lines
                        line = data.toString().split('\n').length;
                        css[cssName[index]] = line;
                    }
                });
            save();
        })
        .catch(function(err) {
            console.log(err)
        });

}


function save() {
    for (let key in level) {
        item = {"level": parseInt(key), "elements": level[key]}
        level_c.push(item)
    }
    for (let key in css) {
        item = {"source": key, "loc": css[key]}
        css_c.push(item)
    }
    var json = {"dom": dom, "depth": level_c, "css": css_c};
    
    // get site name from url
    let siteName = url.replace('http://','').replace('https://','').replace('www.','').split(/[/?#]/)[0];

    let location = __dirname;
    let location_save = location + "/output/" + siteName + ".json";
    json = JSON.stringify(json);
    fs.writeFileSync(location_save, json, 'utf8');
    
    console.log("Successfully parsed CSS files.")
    console.log("Saved as " + siteName + ".json")
}
