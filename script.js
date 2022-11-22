
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
function getNearestShop(clientCoordinates) {
    const shopsList = getShopsCoordinates ()
    .then(res => {
       const data = res.json()

       return data
    })
    .then((res) => {
        const citiesCoordinates = Object.values(res)

        const nearestShop = citiesCoordinates.reduce((acc, {longitude,latitude}) => {
            const [clientLatitude, clientLongitude] = clientCoordinates
            const getDistance = distance(longitude,latitude, clientLongitude, clientLatitude) 
            console.log(acc)
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

// выпадающий списко адресов

function init() {
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
            boundedBy: [[46.080873, 32.520030], [44.091149, 36.246333]],
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
            .then((res) => {
                return  [clientPos1, clientPos2] = res
            })
            .then(([pos1, pos2]) => {
              return  getNearestShop([pos1, pos2])
            })
            .then(res => console.log(res / 1000))
    })
}

ymaps.ready(init);

