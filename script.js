function distance(lat1,lng1,lat2,lng2) {
    const plq = new YMaps.GeoCoordSystem();
    let rasto = plq.distance(new YMaps.GeoPoint(lat1,lng1), new YMaps.GeoPoint(lat2,lng2));

    return rasto;
}

function getClientCoordinates (adress) {
    const key = '8113cc91-8180-40e6-a9a2-433f7c13fcf4'   
    const clientCoordinates = fetch(`https://geocode-maps.yandex.ru/1.x/?apikey=${key}&format=json&geocode=${adress}`)
    
    return clientCoordinates
}

function getShopsCoordinates () {
    const coordonates = fetch('spetz_shops.json')

    return coordonates
}

// получаем ближайший магазин к клиенту
async function getNearestShop(clientCoordinates) {
    const shopsList = await getShopsCoordinates ()
    .then(res => {
       const data = res.json()

       return data
    })
    .then((res) => {
        const citiesCoordinates = Object.values(res)

        const nearestShop = citiesCoordinates.reduce((acc, {longitude,latitude}) => {
            const [clientLatitude, clientLongitude] = clientCoordinates
            const getDistance = distance(longitude,latitude, clientLongitude, clientLatitude) 
            
            if(!acc) return getDistance

            if(acc > getDistance) {
                acc = getDistance
            }

            return acc
        }, 0)

        return nearestShop
    })

    return shopsList
}

function getRoutes () {
    // получаем данные о маршрутах
    const routes = fetch('routes.json')
    
    return routes
}

function buildRoute (routeList, myMap, adresDelivery) {
    // получаем адрес доставки, меняем местами долготоу и широту так надо для яндекса) 
    const adress = adresDelivery.flat().reverse().join(', ')
    // строим маршрут с учетом нового адресса доставки
    return routeList().then(res => res.json())
    .then(res => {
        
        const routesList = Object.values(res)
        
        const routes =  routesList.map(item => {
            
            const adressList = item.adressList
            const oldDuration = item.duration // длина маршрута до добавления нового пункта
            
            adressList.push(adress)

            const newRoute =  new ymaps.multiRouter.MultiRoute ({ 
                referencePoints: adressList
            }) 

            myMap.geoObjects.add(newRoute)

            return {oldDuration: oldDuration, newRoute: newRoute}
          
        })

        return routes // возвращаем построенный маршрут 
    })   
    
}

// 

function getOptimalRoute(routesList) {
    // перебираем маршруты
        //  вычисляем растояние
        // сравниваем с исходными данными
        //  надодим маршрут с минимальным увеличением растояния
        // возвращаем его
        console.log(routesList) // массив!

        const optimalRoutes = Promise.all(
            routesList.map(({oldDuration, newRoute}) => {

                const getDistance = new Promise((res) => {

                    newRoute.model.events.add('requestsuccess', function() {
                        res(newRoute.getActiveRoute())     
                    })
                })
                
                .then(res => {
                    const newDistance = res.properties.get("distance").value
                    const newDistanceKm = Math.ceil(newDistance / 1000) 
                    console.log(res.properties.get("distance"))
                    return [oldDuration, newDistanceKm]
                }) 
            
                return getDistance
            })
        )
        .then(res => {

            // получаем расстояние на которое изменились маршруты
            const distanceModification = res.map(([oldDuration, newDistanceKm])=> {
                return newDistanceKm - oldDuration
            })

            return distanceModification
        }) 
        .then(res => {
            // находим минимальное изменение маршрута
            return Math.min(...res)
        })

        return optimalRoutes
        
   
}

// выпадающий списко адресов

function init() {
    const borderCrimea = [[46.080873, 32.520030], [44.091149, 36.246333]] // гранцы Крыма
    const suggestView1 = new ymaps.SuggestView('suggest1',
        { 
            provider: {
                suggest: (request, options) => {
                   const serchFilter =  ymaps.suggest('Республика Крым' + request)
                   .then(res => {
                        return res
                   })
                   return serchFilter
                }
            },
            boundedBy: borderCrimea,
            offset: [20, 30],
            results: 10,
            width :400,
        }
    ); 
    suggestView1.events.add('select', (e) => {
        const result =  getClientCoordinates (e.get('item').value)
            .then(res => res.json())
            .then((res) => {
                const data =  res.response['GeoObjectCollection']['featureMember'][0]['GeoObject']['Point']['pos']
                const splitData =  data.split(' ')
                return splitData
            })
            .then(async (res) => {
                const [pos1, pos2] = res
                const distanceNearestShop = await getNearestShop([pos1, pos2]) / 1000
                const minDistance =  getOptimalRoute( await buildRoute(getRoutes,myMap, res)) 

                if(distanceNearestShop / 1000 > 50) {
                    return minDistance    
                }
                return distanceNearestShop
            
            })
            .then((res) => {
                console.log('Растояние оплачиваемой доставки' + res)

            })
    })

    var myMap = new ymaps.Map('map', {
        center: [44.948227, 34.100264],
        zoom: 9,
        controls: []
    });

}

ymaps.ready(init);






