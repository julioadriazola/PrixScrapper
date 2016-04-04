// var phantom = require('phantom');
var spf = require('sprintf-js').vsprintf;
var mongo = require('mongodb').MongoClient;
var assert = require('assert');
var ObjectId = require('mongodb').ObjectID;
var url = 'mongodb://localhost:27017/test';

var db = null;
var c_store= {name: "Lider"};

module.exports = {



	//New products and price refresh
	scrapProductPrices: function(categoria,fn){
		var route = {
			url: 'https://secure.lider.cl/walmart/catalog/categoryFood.jsp?&id=%s#categoryCategory=%s&pageSizeCategory=%d',
			args: [categoria.cat_id,categoria.cat_id,categoria.size]
		};
		// sails.log(spf(route.url,route.args));
		var wait = Math.ceil(60*categoria.size/600);
		A.phantomSSL(
			spf(route.url,route.args),
			wait,
			function(ph,page){

				var evalf= function(){
					//The last element has nothing (I don't know why)
					return $.makeArray($('.elemento-recomendado').slice(0,-1))
					.map(function(e){

						product_id = $(e).find('a.descrip').attr('href').match(/productid=[^&]+/gi)?
									$(e)
											.find('a.descrip')
											.attr('href')
											.match(/productid=[^&]+/gi)[0]
											.replace(/productid=/gi,"")
											.toUpperCase()
									:null;
						return {
							prices: [
								{
									actual_price: 			parseInt($(e).find('.sale-price').text().replace(/[^0-9,]/g,"")),
									//normal_price can be NaN or 0.
									normal_price: 	parseInt($(e).find('.internet-price').text().replace(/[^0-9,]/g,"")),
									updated_at: new Date()
								}
							],
							ref: 			parseInt($(e).find('.prod_referencia').text().match(/[0-9]+/g)[0]),
							updated_at: 	new Date(),
							created_at: 	new Date(),
							product_id: 	product_id,
							href: 			$(e).find('a.descrip').attr('href')
						};
					});
				};

				page.evaluate(evalf).then(function(a){
					if(a.length){
						page.close();
						ph.exit();
						fn(categoria,a);

					}
					else
					{
						setTimeout(function(){
							page.evaluate(evalf).then(function(a){
								if(a.length){
									page.close();
									ph.exit();
									sails.log("Second time");
									fn(categoria,a);
								}
								else{
									setTimeout(function(){
										page.evaluate(evalf).then(function(a){
											page.close();
											ph.exit();
											sails.log("Third time");
											fn(categoria,a);

										});
									},3*wait*1000);
								}
							});
						},wait*1000);
					}
				});
			}
		);
	},

	updateCategory: function(category,update,fn){
		A.start(function(err){
			if(err) return fn(err);
			db.collection('categories').updateOne(category,update,fn);
		});
	},

	a: function(){
		A.refreshProducts({scrape_it: true});
	},

	aa: function(){
		A.refreshProducts({scrape_it:true, errored:true});
	},

	aaa: function(){
		A.refreshProducts({scrape_it:true, name: /conserva/i });
	},

	insertOrUpdateProduct: function(category,scraped_products,fn){
		A.start(function(err){
			if(err) return fn(err);
			A.getProducts({store_id: category.store_id},function(err,products){
				if(err) return fn(err);

				var prod_comp = products.map(function(el){ return el.ref;});
				var new_products = [];
				var existing_products = [];

				scraped_products.map(function(el){
					var index = prod_comp.indexOf(el.ref);
					if( index == -1){
						el.store_id = category.store_id;
						el.actual_price= el.prices[0].actual_price;
						el.normal_price= el.prices[0].normal_price?el.prices[0].normal_price:el.prices[0].actual_price;
						new_products.push(el);
					}
					else{
						el.prices[0].normal_price= el.prices[0].normal_price?el.prices[0].normal_price:el.prices[0].actual_price;
						var tmp= {
							where: {_id: products[index]._id},
							push:  el.prices[0]
						};
						existing_products.push(tmp);
					}
				});

				A.addProducts(new_products,function(err,products){
					if(err) return fn(err);
					A.updateMultipleProductPrices(existing_products,fn);
				});


			});
		});
	},

	updateMultipleProductPrices: function(updates,fn,i){
		if(!updates.length) return fn(null);
		if(!i) i = 0;

		if(i == updates.length) return fn(null);
		A.updateProduct(
			updates[i].where,
			{
				$set: 	updates[i].push,
				$push: 	{
							prices:  updates[i].push
						}
			},
			function(err,p){
				if(err) return fn(err);
				A.updateMultipleProductPrices(updates,fn,i+1);
				// A.updateMultipleProductPrices(updates,fn,updates.length);
			}

		);
		
	},

	updateProduct: function(product,update,fn){
		A.start(function(err){
			if(err) return fn(err);
			db.collection('products').updateOne(product,update,fn);
		});
	},

	addProducts: function(products,fn){
		if(!products.length) return fn(null,[]);
		A.start(function(err){
			if(err) return fn(err);
			db.collection('products').insertMany(products,fn);
		});
	},

	refreshProducts: function(categories_s){
		A.getStore(c_store,function(err,store){
			if(err) return sails.log.error(err);

			categories_s.store_id = store._id;
			A.getCategories(categories_s,function(err,categories){
				if(err) return sails.log.error(err);

				var callit = function(i){

					if(!categories.length) return;
					if(!i) i = 0;
					if(categories.length == i) return;

					var cat = categories[i];
					A.updateCategory({_id:cat._id},
						{
							$set:{status: "processing"},
							$currentDate:{updated_at: {$type: "timestamp"}}
						},
						function(err){
						A.scrapProductPrices(cat,function(cat,r){
							A.insertOrUpdateProduct(cat,r,function(err){
								if(err) return sails.log.error(err);

								A.updateCategory({_id:cat._id},
								{
									$set: {
										errored: 	r.length?false:true,
										real_size:  r.length?r.length:cat.real_size,
										size: 		r.length?Math.max(100,2*r.length):cat.size,
										status: 	r.length?"processed":"failed"
									},
									$currentDate:{
										updated_at: {$type: "timestamp"}
									}
								},
								function(err){
									if(err) return sails.log.error(err);
									sails.log(cat.name + " has " + r.length + " products");
								});
							});
						});
					});

					setTimeout(function(){callit(i+1)},2*1000);
				}; // end function callit 


				callit();
			});
		});
	},


	//Categories
	scrapCategories: function(fn){
		var wait= 0;
		var route = {
			url: 'https://secure.lider.cl/walmart/home.jsp',
			args: []
		};


		A.phantomSSL(
			spf(route.url,route.args),
			wait,
			function(ph,page){
				page.evaluate(function(){
					return $.makeArray($('ul.sub-menu-desplegable li.title a')).map(function(e){
							return {
								name: 		$(e).text().trim(),
								cat_id: 	$(e).attr('href')
											.match(/\?id=[^&]+/gi)[0]
											.replace(/\?id=/gi,""),
								href: 		$(e).attr('href'),
								created_at: new Date(),
								updated_at: new Date(),
								size: 		1000,
								scrape_it: 	true,
								ignore: 	false
							};
						});
				}).then(function(a){
					page.close();
					ph.exit();
					fn(a);
				});
			}
		);
	},

	b: function(){
		A.getStore(c_store,function(err,store){
			if(err) return sails.log(err);

			sails.log(store);
			A.getCategories({store_id: store._id},function(err,categories){
				if(err) return sails.log(err);
			});

		});
	},

	scrapNewCategories: function(){
		
		A.scrapCategories(function(scraped_categories){
			A.getStore(c_store,function(err,store){
				if(err) return sails.log.error(err);
				A.getCategories({store_id: store._id},function(err,categories){
					if(err) return sails.log.error(err);

					sails.log(categories.length);

					var cat_upper = categories.map(function(el){ return el.cat_id.toUpperCase();});
					var new_categories = [];
					scraped_categories.map(function(el){
						if(cat_upper.indexOf(el.cat_id.toUpperCase()) == -1){
							el.store_id = store._id;
							new_categories.push(el);
						}
					});

					A.addCategories(new_categories,function(err,results){
						if(err) return sails.log.error(err);

						sails.log("Inserted "+ new_categories.length+" new categories");
					});

				});

			});
		});
	},

	addCategories: function(categories,fn){
		if(!categories.length) return fn(null,[]);
		A.start(function(err){
			if(err) return fn(err);
			db.collection('categories').insertMany(categories,fn);
		});
	},
	//Product detail
	f: function(a){
		/*
			PROD_6053567	jugo vivo
			PROD_6423148	tele
			PROD_6714994 	Notebook
			PROD_6048946 	Pistola silicona
			PROD_1395693	Jabon barra
			PROD_2794242	Leche colun
			PROD_6417819	Lenovo Notebook

		 */
		var wait= 1;
		var route = {
			url: 'http://www.lider.cl/walmart/catalog/product/productDetails.jsp?productId=%s',
			// args: ['PROD_6053567']
			args: [a?a:'PROD_6714994']
		};

		sails.log(spf(route.url,route.args));

		A.phantomSSL(
			spf(route.url,route.args),
			wait,
			function(ph,page){
				page.evaluate(function(){
					var tmp = {
						brand: $('.titulo-ficha-superior span[itemprop=brand]').text().trim(),
						name: $('.titulo-ficha-superior span[itemprop=name]').text().trim(),
						ref: $('.titulo-ficha-superior span[itemprop=sku]').text().trim(),
						images: $.makeArray($('.MagicScrollItem a'))
								.map(function(e){
									return 'http://www.lider.cl'+$(e).attr('href');
								})
					};
					if($('#ModCarac').length){
						tmp.type = 'tecnologico';
						tmp.features = $.makeArray($('#ModCarac .wrapMetaContent'))
										.map(function(e){
											return { key: $(e).find('p.firstItem').text().trim(), 
											val: $(e).find('p.secondItem').text().trim()
											};
										});
						return tmp;

					}
					else if($('#wrapDescProd').length){
						tmp.type = 'almacen';
						tmp.features = $('#wrapDescProd .feature p')
										.html()
										.replace(/(&nbsp;|<strong>|:)/g,"")
										.split("<br>")
										.map(function(e){ 
											var a = e.split("</strong>"); 
											return a.length==2?
												{key: a[0].trim(), val: a[1].trim()}
												:null; 
										});
						return tmp;
					}
				}).then(function(a){
					sails.log("F RESULT -->");
					sails.log(a);
					page.close();
					ph.exit();
				});
			}
		);
	},

	newStore: function(store,fn){
		A.start(function(err){
			if(err) return fn(err);
			db.collection('stores').insertOne(store,function(err,result){
				if(err) return fn(err);
				sails.log("New store inserted with id: " + result.insertedId);
				fn(null, result);
			});
		});
	},

	getCategories: function(where,fn){
		A.start(function(err){
			if(err) return fn(err);
			var cursor = db.collection('categories').find(where);
			var categories = [];

			cursor.each(function(err,doc){
				if(err) return fn(err);
				if(doc) categories.push(doc);
				else fn(null,categories);
			});
		});
	},

	insertLider: function(){
		A.newStore(
			{
				name: 			"Lider",
				main_page: 		"https://secure.lider.cl/walmart/home.jsp",
				use_scraper: 	true,
				razon_social: 	"Líder Domicilio Ventas y Distribución Limitada",
				rut: 			78968610,
				rut_v: 			6,
				created_at: 	new Date(),
				updated_at: 	new Date()
			},
			function(err,result){
				if(err) sails.log.error(err);
			});
	},

	getStore: function(where,fn){
		A.start(function(err){
			if(err) return fn(err);
			var cursor = db.collection('stores').find(where);
			var store = null;

			cursor.each(function(err,doc){
				if(err) return fn(err);
				if(doc) store = doc;
				else fn(null,store);
			});
		});
	},

	getProducts: function(where,fn){
		A.start(function(err){
			if(err) return fn(err);

			var cursor = db.collection('products').find(where);
			var products = [];

			cursor.each(function(err,doc){
				if(err) return fn(err);
				if(doc) products.push(doc);
				else fn(null,products);
			});
		});
	},

	phantomNoSSL: function(route,wait,fn){
		var phantom = require('phantom');
		phantom.create().then(function(ph) {
			ph.createPage().then(function(page) {
				page.open(route).then(function(status) {
					sails.log.silly(status);
					page.injectJs('http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js').then(function(){
						setTimeout(function(){fn(ph,page);}, wait * 1000);
					});
				});
			});
		});
	},

	phantomSSL: function(route,wait,fn){
		var phantom = require('phantom');
		phantom.create(['--ignore-ssl-errors=yes','--ssl-protocol=any']).then(function(ph) {
			ph.createPage().then(function(page) {
				page.open(route).then(function(status) {
					sails.log.silly(status);
					page.injectJs('http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js').then(function(){
						setTimeout(function(){fn(ph,page);}, wait * 1000);
					});
				});
			});
		});
	},

	start: function(fn){

		if(db) return fn();
		mongo.connect(url, function(err, dbo) {
			if(err) return fn(err);
			db = dbo;
			sails.log.info("Connected correctly to server.");
			fn();
		});
	},

	// 
};