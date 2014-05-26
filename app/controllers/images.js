'use strict';

var image_files_directory = "/var/www/officeus.therrien-barley.com/public_html/apps/OfficeUS-Feeds/public/img/instagram/";
var image_files_extension = ".jpg";

var mongoose = require('mongoose'),
	fs = require('fs'),
    request = require('request');

exports.get = function(req, res){
	res.send('getted');
}

/////// GLOBALS
var days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/////// END GLOBALS


/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Image = mongoose.model('Image'),
    _ = require('lodash');


/**
 * Find image by id
 */
exports.image = function(req, res, next, id) {
    Image.load(id, function(err, image) {
        if (err) return next(err);
        if (!image) return next(new Error('Failed to load image ' + id));
        req.image = image;
        next();
    });
};

/**
 * Get an image by id
*/
exports.get = function(id){
	Image.load(id, function(err, image) {
        if (err){
        	console.log('error attempting to get image: ' + err);
        	return null;
        }else if (!image){
        	//console.log('No image with id: ' + id);
        	return null;
        }else{
        	//console.log('got image');
        	return image;
        }
    });
};

exports.getByInstagramID = function(iid){
	Image.findOne({ instagram_id: iid}, function(err, image) {
        if (err){
        	console.log('error attempting to get image by instagram_id with msg: ' + err);
        	return null;
        }else if (!image){
        	//console.log('No image with instagram_id: ' + iid);
        	return null;
        }else{
        	//console.log('got image by instagram_id');
        	return image;
        }
    });
};


// returns true if image is clean, otherwise returns false
function isImageCorrupt(img){
	//check for required fields
	if( !img.created_time ) return false;
	if( !img.user.username ) return false;
	if( !img.link ) return false;
	if( !img.images.standard_resolution.url ) return false;
	if( !img.id ) return false;

	//all checks passed
	return true;
};


var upsertArrayHandlerRecursive = function(imgs, idx, next){

	console.log('idx: ' + idx);
	console.log('imgs.length: ' + imgs.length);

	if(idx >= imgs.length){
		next();
	}else{

		Image.findOne({ instagram_id: imgs[idx].id }, function(err, image) {
	        if (err){
	        	console.log('error attempting to get image by instagram_id with msg: ' + err);
	        	return null;
	        }else if (!image){
	        	console.log('No image with instagram_id: ' + imgs[idx].id + ' so we\'re creating it');
	        	
	        	var upsert_image = imgs[idx]; 

	        	if( isImageCorrupt(upsert_image) ){

					var image = new Image();

					//instagram ID: will check against this later for duplicates
					image.instagram_id = upsert_image.id;

					image.created_time = upsert_image.created_time;
					image.username = upsert_image.user.username;
					image.fullname = upsert_image.user.full_name;
					image.image_url = upsert_image.images.standard_resolution.url;
					image.link = upsert_image.link;

					image.caption = (upsert_image.caption) ? upsert_image.caption.text : "";
					
					image.latitude = (upsert_image.location) ? upsert_image.location.latitude : null;
					image.longitude = (upsert_image.location) ? upsert_image.location.longitude : null;

					//additional fields, may use later
					image.filter = upsert_image.filter;
					image.user_website = (upsert_image.user.website) ? upsert_image.user.website : null;

					image.tags = upsert_image.tags;
					

					//set flags for later downloading from Instagram
					image.downloaded = false;
					image.uploaded = false;

					//set the city based on the hashtag
					image.city = (upsert_image.city) ? upsert_image.city : "";

					//save the image to the database
				    image.save(function(err) {
				        if (err) {
				        	console.log('error attempting to save image');
				        } else {
				        	console.log('created new image');
				        	idx++;//increment index
				        	upsertArrayHandlerRecursive(imgs, idx, next); //run recursively on the next image
				        }
				    });
				//end if image is corrupted
				}else{
					console.log('******* IMAGE FLAWED skipping to next *******');
			    	idx++;//increment index
			    	upsertArrayHandlerRecursive(imgs, idx, next); //run recursively on the next image
				}

			//end if image already exists
	        }else{
	        	console.log('image already exists, don\'t create');
	        	idx++;//increment index
			    upsertArrayHandlerRecursive(imgs, idx, next); //run recursively on the next image
	        }
	    });
	}//end if idx >= imgs.length
};

/**
 * Upsert an array of Instagram images into the database
 */
exports.upsertArray = function(imgs, next) {

	upsertArrayHandlerRecursive(imgs, 0, next);
};

/**
 * Upsert an Instagram image into the database
 */
var upsert = exports.upsert = function(upsert_image, next) {
	//check if missing key information, in which case, break
	if( isImageCorrupt(upsert_image) ){

		var image = new Image();

		//instagram ID: will check against this later for duplicates
		image.instagram_id = upsert_image.id;

		image.created_time = upsert_image.created_time;
		image.username = upsert_image.user.username;
		image.image_url = upsert_image.images.standard_resolution.url;
		image.link = upsert_image.link;

		image.caption = (upsert_image.caption) ? upsert_image.caption.text : "";
		
		image.latitude = (upsert_image.location) ? upsert_image.location.latitude : null;
		image.longitude = (upsert_image.location) ? upsert_image.location.longitude : null;

		//additional fields, may use later
		image.filter = upsert_image.filter;
		image.user_website = (upsert_image.user.website) ? upsert_image.user.website : null;

		

		//set flags for later downloading from Instagram
		image.downloaded = false;
		image.uploaded = false;

		//set the city based on the hashtag
		image.city = (upsert_image.city) ? upsert_image.city : "";

		//save the image to the database
	    image.save(function(err) {
	        if (err) {
	        	console.log('error attempting to save image');
	        } else {
	        	console.log('created new image');
	        	idx++;//increment index
	        	next(im, idx);//run recursively on the next image
	        }
	    });
	//end if image is corrupted
	}else{
		console.log('******* IMAGE FLAWED skipping to next *******');
    	idx++;//increment index
    	next(im, idx);//run recursively on the next image
	}
    
};



function downloadArrayByInstagramID(images, idx, next){

	console.log('entering downloadArrayByInstagramID: ' + idx + '/' + images.length);

	if(idx < images.length){

		Image.findOne({ instagram_id: images[idx].instagram_id }, function(err, image) {
	        if (err){
	        	console.log('error attempting to downloadByInstagramID with msg: ' + err);
	        	console.log('moving on to the next'.red);
	        	idx++;
				downloadArrayByInstagramID(images, idx, next);
	        }else if (!image){
	        	console.log('downloadByInstagramID problem: no image with instagram_id: ' + images[idx].instagram_id);
	        	console.log('moving on to the next'.red);
	        	idx++;
				downloadArrayByInstagramID(images, idx, next);
	        }else{
	        	var uri = image.image_url;
	        	var filename = image_files_directory + image.instagram_id + image_files_extension;

	        	request.head(uri, function(err, res, body){
					console.log('content-type:', res.headers['content-type']);
					console.log('content-length:', res.headers['content-length']);
				
					//download and write the image binary to disc
					request(uri).pipe(fs.createWriteStream(filename)).on('close', function(){
						//set downloaded flag to true
						Image.update({ instagram_id: images[idx].instagram_id}, { downloaded: true }, function(err){
							if(err) console.log('error attempting to update image with download flag with msg: ' + msg);
							//callback after flag set
							idx++;
							downloadArrayByInstagramID(images, idx, next);

						});
					});
				});
	        }
	    });
	}else{
		console.log('finished downloading images');

		next(); //callback function
	}
			
};

exports.downloadAll = function(next){
	Image.find({ downloaded: false }).exec(function(err, images) {
        if (err) {
            console.log("error attempting to get all images for downloadAll with msg: " + msg);
        } else {
            downloadArrayByInstagramID(images, 0, next);
        }
    });
}



/**
 * Create an image
 */
exports.create = function(im) {

	var image = new Image();
	//image._id = mongoose.Types.ObjectId(im.id);//set _id to Instagram id

	image.created_time = im.created_time;
	image.username = im.user.username;
	image.caption = im.caption.text;
	image.link = im.link;

	if(im.location){
		image.latitutde = im.location.latitude;
		image.longitude = im.location.longitude;
	}else{
		image.latitutde = null;
		image.longitude = null;
	}

	image.filter = im.filter;
	image.image_url = im.images.standard_resolution.url;
	image.user_website = im.user.website;
	image.instagram_id = im.id;


    image.save(function(err) {
        if (err) {
        	console.log('error attempting to save image');
        } else {
        	//console.log('created new image');
        }
    });
};

/**
 * Update an image
 */
exports.update = function(req, res) {
    var image = req.image;

    image = _.extend(image, req.body);

    image.save(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                image: image
            });
        } else {
            res.jsonp(image);
        }
    });
};

/**
 * Delete an image
 */
exports.destroy = function(req, res) {
    var image = req.image;

    image.remove(function(err) {
        if (err) {
            return res.send('users/signup', {
                errors: err.errors,
                image: image
            });
        } else {
            res.jsonp(image);
        }
    });
};

/**
 * Show an image
 */
exports.show = function(req, res) {
    res.jsonp(req.image);
};

/**
 * List of Images
 */
exports.all = function(req, res) {
    Image.find().sort('-created_time').exec(function(err, images) {
        if (err) {
            console.log("error attempting to get all images with msg: " + msg);
        } else {
        	console.log('total images in database: ' + images.length);
            return images;
        }
    });
};























