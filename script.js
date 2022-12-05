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
    .then (res =>{
        const data = res.json()
        return data
    } )
    

    return coordonates
}

// получаем ближайший магазин к клиенту
async function getNearestShop(clientCoordinates) {
    const shopsList = await getShopsCoordinates ()
    const citiesCoordinates = Object.values(shopsList)

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
}

function getRoutes () {
    // получаем данные о маршрутах
    const routes = fetch('routes.json')
    .then(res => {
        const data = res.json()
        return data
    })
    
    return routes
}

async function buildRoute (routeList, myMap, adresDelivery) {
    // получаем адрес доставки, меняем местами долготоу и широту так надо для яндекса) 
    const adress = adresDelivery.flat().reverse().join(', ')
    const routes = await routeList()
    const routesList = Object.values(routes)

    const routesInfo =  routesList.map(item => {
        
        const adressList = item.adressList
        const oldDuration = item.duration // длина маршрута до добавления нового пункта
        
        adressList.push(adress)

        const newRoute =  new ymaps.multiRouter.MultiRoute ({ 
            referencePoints: adressList
        }) // перестроенныенный маршрут с добавление точки доставки
        // console.log(newRoute)
        // myMap.geoObjects.add(newRoute)

        return {oldDuration: oldDuration, newRoute: newRoute}
        
    })

    return routesInfo // возвращаем построенный маршрут 
    
}

function getOptimalRoute(routesList, myMap) {
    // перебираем маршруты
        //  вычисляем растояние
        // сравниваем с исходными данными
        //  надодим маршрут с минимальным увеличением растояния
        // возвращаем его

        const optimalRoutes = Promise.all(
            routesList.map(({oldDuration, newRoute}) => {

                const getDistance = new Promise((res) => {

                    newRoute.model.events.add('requestsuccess', function() {
                        res(newRoute.getActiveRoute())     
                    })
                })
                
                .then(res => {
                    console.log(res)
                    // myMap.geoObjects.add(newRoute)
                    const newDistance = res.properties.get("distance").value
                    const newDistanceKm = Math.ceil(newDistance / 1000) 
                    console.log(res.properties.get("distance"))
                    console.log(oldDuration + ' ' + newDistance)
                    return {ds : [oldDuration, newDistanceKm], rout: res}
                }) 
                
                return getDistance
            })
        )
        .then((res) => {
            console.log(res)
            // const [ds, rout] = res
            
            // debugger
            // получаем расстояние на которое изменились маршруты
            const distanceModification = res.map(({ds, rout})=> {
                
                const [oldDuration, newDistanceKm] = ds
                return {ds: newDistanceKm - oldDuration, rout: rout}
            })

            // const distanceModification = res.map(([oldDuration, newDistanceKm])=> {
            //     return newDistanceKm - oldDuration
            // })

            return distanceModification
        }) 
        .then((res) => {
            // const {dist, rout} = res
            // debugger
            // находим минимальное изменение маршрута
            const distList = res.map(item => item.ds)
            const getRout = res.find( item => {
                if(item.ds === Math.min(...distList)) return item
            })
            // return Math.min(...res)
            myMap.geoObjects.add(getRout.rout)
            return getRout
        })
        // console.log(optimalRoutes)
        // debugger
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
                const data = res.response['GeoObjectCollection']['featureMember'][0]['GeoObject']['Point']['pos']
                const splitData = data.split(' ')
                return splitData
            })
            .then(async (res) => {
                const [pos1, pos2] = res
                const distanceNearestShop = await getNearestShop([pos1, pos2]) / 1000
                const minDistance =  getOptimalRoute( await buildRoute( getRoutes,myMap, res), myMap) 

                if(distanceNearestShop / 1000 > 50) {
                    return minDistance    
                }
                return distanceNearestShop
            
            })
            .then((res)=> {
                alert('Растояние оплачиваемой доставки' + Math.round(res))  
            })
    })

    const suggest = document.querySelector('#suggest1')

    suggest.addEventListener('keydown', (e) => {
        if(e.code !== 'NumpadEnter') return
        const result =  getClientCoordinates (e.target.value)
        .then(res => res.json())
        .then((res) => {
            const data =  res.response['GeoObjectCollection']['featureMember'][0]['GeoObject']['Point']['pos']
            const splitData =  data.split(' ')
            return splitData
        })
        .then(async (res) => {
            const [pos1, pos2] = res
            const distanceNearestShop = await getNearestShop([pos1, pos2]) / 1000
            const minDistance =  getOptimalRoute( await buildRoute( getRoutes,myMap, res), myMap) 

            if(distanceNearestShop / 1000 > 50) {
                return minDistance    
            }
            return distanceNearestShop
        
        })
        .then((res)=> {
           alert('Растояние оплачиваемой доставки' + Math.round(res)) 
           
        })

    })

    var myMap = new ymaps.Map('map', {
        center: [44.948227, 34.100264],
        zoom: 9,
        controls: []
    });

}

ymaps.ready(init)






