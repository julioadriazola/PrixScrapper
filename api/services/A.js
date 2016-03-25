// var phantom = require('phantom');
var spf = require('sprintf-js').vsprintf;

module.exports = {

	doSomething: function(route,wait,fn){
		var phantom = require('phantom');
		phantom.create().then(function(ph) {
			ph.createPage().then(function(page) {
				page.open(route).then(function(status) {
					sails.log(status);
					page.injectJs('http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js').then(function(){
						setTimeout(fn(ph,page), wait * 1000);
					});
				});
			});
		});
	},

	


	//New products and price refresh
	e: function(){
		var categoria = "CF_Nivel3_000042";
		var size = 5;
		var wait= 10;
		var route = {
			url: 'http://www.lider.cl/walmart/catalog/categoryFood.jsp?&id=%s#categoryCategory=%s&pageSizeCategory=%d',
			args: [categoria,categoria,size]
		};

		A.doSomething(
			spf(route.url,route.args),
			wait,
			function(ph,page){
				page.evaluate(function(){
					return dataLayer[0].products;
					// NO DELETE: This is an optional way, do the mapping manually.
					// $.makeArray($('.elemento-recomendado')).map(function(e){
					// 		return {
					// 			nombre: $(e).find('.nombre a p').text().trim(),
					// 			precio: $(e).find('.precio .sale-price').text().trim()
					// 		};
					// 	});
				}).then(function(a){
					sails.log("E RESULT -->");
					sails.log(a);
					page.close();
					ph.exit();
				});
			}
		);
	},

	// Nuevas categorias
	dd: function(){
		var wait= 0;
		var route = {
			url: 'http://www.lider.cl/walmart/home.jsp',
			args: []
		};

		phantom.create().then(function(ph) {
			ph.createPage().then(function(page) {
				page.open(spf(route.url,route.args)).then(function(status) {
					sails.log(status);

					page.injectJs('http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js').then(function(){

						setTimeout(function(){
							page.evaluate(function(){
								return $.makeArray($('ul.sub-menu-desplegable li.title a')).map(function(e){
										return {
											name: $(e).text().trim(),
											cat_id: $(e).attr('href').match(/\?id=[^&]+/gi)[0].replace(/\?id=/gi,""),
											href: $(e).attr('href')
										};
									});
							}).then(function(a){
								sails.log(a);
								page.close();
								ph.exit();
							});
						}, wait * 1000);
					});
				});
			});
		});
	},

	//Categories
	d: function(){
		var wait= 0;
		var route = {
			url: 'http://www.lider.cl/walmart/home.jsp',
			args: []
		};

		A.doSomething(
			spf(route.url,route.args),
			wait,
			function(ph,page){
				page.evaluate(function(){
					return $.makeArray($('ul.sub-menu-desplegable li.title a')).map(function(e){
							return {
								name: $(e).text().trim(),
								cat_id: $(e).attr('href').match(/\?id=[^&]+/gi)[0].replace(/\?id=/gi,""),
								href: $(e).attr('href')
							};
						});
				}).then(function(a){
					sails.log("D RESULT -->");
					sails.log(a);
					page.close();
					ph.exit();
				});
			}
		);
	},

	ff: function(a){
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
		phantom.create().then(function(ph) {
			ph.createPage().then(function(page) {
				page.open(spf(route.url,route.args)).then(function(status) {
					sails.log(status);

					page.injectJs('http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js').then(function(){

						setTimeout(function(){
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
								sails.log(a);
								page.close();
								ph.exit();
							});
						}, wait * 1000);
					});
				});
			});
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

		A.doSomething(
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

	// 
};