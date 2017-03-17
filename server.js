var express = require('express');
var mongo = require('mongodb').MongoClient
var GoogleSearch = require('google-search');

var app = express();

var mongoUri = process.env.MONGODB_URI;

var googleSearch = new GoogleSearch({
  key: process.env.GOOGLE_API_KEY,
  cx: process.env.GOOGLE_API_CX
});

// search images
app.get('/api/imagesearch/:searchTerms', function (req, res) {
    try {
        var output = [];
        var offset = isNaN(req.query.offset) ? 1 : parseInt(req.query.offset);
        if (offset < 1) offset = 1;
        
        googleSearch.build({
            q: req.params.searchTerms,
            searchType: "image",
            start: offset,
            fields: "items(image(contextLink,thumbnailLink),link,title)"
        }, function(err, response) {
            if (err) {
                console.log(err);
                res.status(500).send({ error: err.message });
            }
            
            mongo.connect(mongoUri, function(err, db) {
                if (err) {
                    console.log(err);
                    res.status(500).send({ error: err.message });
                }
                else {
                    var collection = db.collection('queries');
                    
                    // insert query
                    collection.insert({
                        query: req.params.searchTerms,
                        created: new Date()
                    }, function (err, result) {
                        if (err) {
                            console.log(err);
                            res.status(500).send({ error: err.message });
                        }
                        else {
                            // keep only 10 queries
                            var options = {sort: "created"};
                            collection.find({}, options).toArray(function(err, docs) {
                                if (err) {
                                    console.log(err);
                                    res.status(500).send({ error: err.message });
                                }
                                if (docs.length > 10) {
                                    var idToRemove = docs[0]._id;
                                    collection.remove({_id: idToRemove});
                                }
                            });
                        }
                    });
                }
            });
            
            // returning results
            for (var i=0; i < response.items.length; i++) {
                var out = {url: response.items[i].link,
                            snippet: response.items[i].title,
                            thumbnail: response.items[i].image.thumbnailLink,
                            context: response.items[i].image.contextLink};
                output.push(out);
            }
            
            res.json(output);
            
        });
    }
    catch (e) {
        res.status(500).send({ error: e.message });
    }
});

// return last 10 queries
app.get('/api/latest/imagesearch', function (req, res) {
    try {
        mongo.connect(mongoUri, function(err, db) {
            if (err) {
                console.log(err);
                throw err;
            }
            else {
                var collection = db.collection('urls');
                
                collection.find({_id: parseInt(req.params.urlId)})
                    .toArray(function(err, docs) {
                        if (err) {
                            console.log(err);
                            throw err;
                        }
                        if (docs[0]) {
                            db.close();
                            
                            res.redirect(docs[0].url);
                        }
                        else {
                            db.close();
                            
                            res.json({error: "Url not found in the database"});
                        }
                    }
                );
            }
        });
    }
    catch (e) {
        res.sendStatus(500);
    }
});

// Any other url
app.get('*', function (req, res) {
    res.send("Please enter a image search, like " + req.headers.host + "/api/imagesearch/lolcats%20funny?offset=10, or \
             look at the 10 most recent searches at " + req.headers.host + "api/latest/imagesearch/");
});

app.listen(process.env.PORT || 8080, function () {
    console.log('App started');
});