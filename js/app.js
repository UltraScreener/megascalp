
class Symbol {
    attributes = {
        price: {
            value: 0,
            get: (normalize = false) => {
                return !normalize ? this.attributes.price.value :
                       parseFloat(this.attributes.price.value).toFixed(this.data.pricePrecision ?? 4)
            },
            set: function(value){ this.value = value }
        },
        change_percent: {
            value: 0,
            get: function(normalize = false){
                return !normalize ? this.value :
                       parseFloat(this.value).toFixed(2) + '%'
            },
            set: function(value){ this.value = value }
        },
        volume: {
            value: 0,
            get: function (normalize = false) {
                if( !normalize ) return this.value
                const suffixes = ["", "k", "м", "млрд", "трлн", "квадр"]
                const order = Math.floor(Math.log10(Math.abs(this.value)) / 3)
                if( order === -Infinity ) return '-'
                const formattedNumber = (this.value / Math.pow(10, order * 3)).toFixed(1)
                return formattedNumber + suffixes[order]
            },
            set: function(value){ this.value = value }
        },
        volatility: {
            value: 0,
            get: function (normalize = false) {
                return normalize ? this.value.toFixed(3) : this.value
            },
            set: function(value){ this.value = value }
        },
    }
    constructor(nameSymbol, data) {
        this.nameSymbol = nameSymbol
        this.data = data
    }
}
window.settings = new class {
    settings = {
        historyCandleStick: '1m',
        historyCandleStickCount: 100,
        volumeGrowthRatio: 2.5,

        chart_count_candles: 100,
        chart_interval: '5m',
        chart_symbol: ''
    }
    get(attribute){
        return this.settings[attribute] ?? false
    }
    removeSettings(){
        window.localStorage.removeItem('settings')
        window.location.reload()
    }
    set(attribute, value) {
        if( !this.settings.hasOwnProperty(attribute) ) {
            console.log('setting attribute not found')
            return false
        }
        this.settings[attribute] = value
        this.saveSettings()
    }
    saveSettings(){
        window.localStorage.setItem('settings', JSON.stringify(this.settings))
    }
    async loadSettings(){
        const _local = window.localStorage.getItem('settings')
        if( !_local ) {
            this.saveSettings()
            return this.loadSettings()
        }
        this.settings = {
            ...this.settings,
            ...JSON.parse(_local)
        }
    }

}
window.symbols = {}
window.render = new class {
    linkBlocks = {
        watchList: $('#watch-list .list'),
        volumeGrowthList: $('#volume-growth .list')
    }
    symbolLinksElements = {}
    /**
     * Обновление аттрибута монеты в шаблоне
     * @param symbol {Symbol}
     * @param attributes {[]}
     */
    updateElement(symbol, attributes){
        if( !this.symbolLinksElements[symbol.nameSymbol] ) return
        attributes.forEach(attribute => {
            const el = this.symbolLinksElements[symbol.nameSymbol][attribute]
            el.text(symbol.attributes[attribute].get(true))
              .attr(`data-${attribute}`, symbol.attributes[attribute].get(false))
        })
    }
    updateCalcMouseToPrice(price) {
        $('[data-calc-to-price]').text(price + '%')
    }
    /**
     * генерация списка монет
     */
    generateWatchList(){
        const _elementClone = this.linkBlocks.watchList.find('[data-symbol]').clone()
        Object.values(window.symbols).forEach(symbol => {
            this.symbolLinksElements[symbol.nameSymbol] = {}
            const el = _elementClone.clone()
            const link = this.symbolLinksElements[symbol.nameSymbol]
            // меняем статичные поля
            el.attr('data-symbol', symbol.nameSymbol)
            el.on('click',() => chart.setSymbol(symbol.nameSymbol) )
            el.find('[data-name]').text(symbol.nameSymbol).attr('data-name',symbol.nameSymbol)

            const dynamicAttributes = ['price', 'change_percent', 'volume', 'volatility']
            dynamicAttributes.forEach(attribute => {
                // меняем динамические поля
                link[attribute] = el.find(`[data-${attribute}]`)
                    .text(symbol.attributes[attribute].get(true))
                    .attr(`data-${attribute}`, symbol.attributes[attribute].get())
            })
            el.removeClass('d-none')
              .appendTo(this.linkBlocks.watchList)
        })
    }
    /**
     * Добавление в список роста объемов
     * @param symbol {string}
     */
    appendVolumeGrowth(symbol){
        this.linkBlocks.volumeGrowthList.find('[data-non-data]').hide()
        const _elementClone = this.linkBlocks.volumeGrowthList.find('button[data-symbol=""]').clone()
        _elementClone.text(symbol)
                     .attr('data-symbol', symbol)
                     .prependTo(this.linkBlocks.volumeGrowthList)
                     .removeClass('d-none')
                     .on('click', () => chart.setSymbol(symbol, settings.get('historyCandleStick')))
        this.symbolLinksElements[symbol]['volumeGrowth'] = _elementClone
    }
    /**
     * Очистика списка роста объемов
     */
    removeVolumeGrowth(){
        this.linkBlocks.volumeGrowthList.find('[data-non-data]').show()
        Object.values(this.symbolLinksElements)
              .filter(e => e['volumeGrowth'] !== undefined)
              .forEach(({volumeGrowth}) => volumeGrowth.remove())
    }
    /**
     * Создание инструментов для работы с графиком
     * @param instruments
     */
    generateInstrumentsForChart(instruments = {}){
        const instrumentsNode = $('#instruments .instruments-list')
        const el = instrumentsNode.find('button[data-instrument=""]')
        Object.keys(instruments)
            .forEach(instrument => {
                const objectInstruments = instruments[instrument]
                switch (Array.isArray(objectInstruments)) {
                    case true:
                        const parent = $('<div>', {id: instrument})
                        objectInstruments
                            .forEach(_instrument => {
                                const cloneEl = el.clone()
                                const btn = cloneEl.text(_instrument.label).removeClass('d-none')
                                btn.on('click', _instrument.callback)
                                parent.append(btn)
                            })
                        parent.appendTo(instrumentsNode)
                        break;
                    case false:
                            const cloneEl = el.clone()
                            const btn = cloneEl.text(objectInstruments.label).removeClass('d-none')
                            btn.on('click', objectInstruments.callback)
                            btn.appendTo(instrumentsNode)
                        break;
                }
            })
    }
}
window.binance = new class {
    async getApi(route, params = {}){
        const url = new URL(`https://fapi.binance.com/fapi/v1/${route}`);
        Object.entries(params).forEach(([key, value]) => {
            url.searchParams.append(key, value);
        });
        return await fetch(url.toString())
            .then(response => response.json())
    }
    async getSymbols(){
        const {symbols} = await this.getApi('exchangeInfo')
        return symbols.filter(e =>
            e.contractType === 'PERPETUAL' && e.quoteAsset === "USDT" && e.status === "TRADING"
        )
    }
    async createWebSocket(route, callback) {
        return new Promise(function(resolve, reject) {
            const server = new WebSocket(`wss://fstream.binance.com/stream?streams=${route}`);
            server.onopen = () => resolve(server)
            server.onerror = (err) => reject(err)
            server.onmessage = ({data}) => callback(JSON.parse(data))
        });
    }
}
window.chart = new class {
    callbackInstruments = {
        timeframes: [
            { label: '1m', callback: () => this.setInterval('1m') },
            { label: '3m', callback: () => this.setInterval('3m') },
            { label: '5m', callback: () => this.setInterval('5m') },
            { label: '15m', callback: () => this.setInterval('15m') },
            { label: '30m', callback: () => this.setInterval('30m') },
            { label: '1H', callback: () => this.setInterval('1h') },
            { label: '4H', callback: () => this.setInterval('4h') },
            { label: '1D', callback: () => this.setInterval('1d') },
        ],
        line: {
            label: 'Линия',
            callback: () => alert('line')
        }
    }
    symbol
    series
    volumeSeries
    chart
    socket
    interval
    constructor() {
        render.generateInstrumentsForChart(this.callbackInstruments)
        this._createChart()
        this._createWidgetCharts()
    }

    /**
     * Создание дополнительных графиков виджетом TradingView
     * @param symbol {string}
     */
    _createWidgetCharts(symbol){
        const symbols = ['BTCUSDT','ETHUSDT']
        const _createWidget = (symbol) => {
            const widget = {
                "autosize": true,
                "symbol": `BINANCE:${symbol}`,
                "interval": "D",
                "timezone": "Etc/UTC",
                "theme": "light",
                "style": "1",
                "locale": "ru",
                "enable_publishing": false,
                "hide_top_toolbar": false,
                "hide_legend": true,
                "save_image": false,
                "container_id": symbol + '-chart'
            }
            new TradingView.widget(widget)
        }
        symbols.forEach(symbol => _createWidget(symbol))
    }
    /**
     * Открываем график определенной монеты
     * @param symbol {string}
     * @param interval {string}
     */
    setSymbol(symbol, interval = ''){
        const _class = symbols[symbol]
        if( !_class ) return
        this.symbol = _class
        settings.set('chart_symbol', symbol)
        render.updateCalcMouseToPrice(0)
        this.setInterval(interval)
    }
    /**
     * Получение исторических свечей для графика по заданной монете и интервалу
     * @returns {Promise<*>}
     * @private
     */
    async _getCandles(){
        return binance.getApi('klines', {
            symbol: this.symbol.nameSymbol,
            interval: this.interval,
            limit: parseInt(settings.get('chart_count_candles'))
        }).then(candles => candles.map(candle => ({
            time: candle[6] / 1000,
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            value: parseFloat(candle[7]),
            color: parseFloat(candle[1]) < parseFloat(candle[4]) ? "rgba(0, 150, 136, 0.8)" : "rgba(255,82,82, 0.8)"
        })))
    }
    /**
     * Создаем новое подключение для получения свечей отключившись от старого при условии существующего подключения
     * @returns {Promise<void>}
     * @private
     */
    async _reConnectSocket(){
        if( this.socket instanceof WebSocket ) await this.socket.close()
        this.socket = await binance
            .createWebSocket(this.symbol.nameSymbol.toLowerCase() + '@kline_' + this.interval.toLowerCase(),
                this._updateChart.bind(this)
            )
    }
    /**
     * Меняем таймфрейм на графике
     * @param interval {string}
     * @returns {void}
     */
     setInterval(interval=''){
        if( interval === '' ) {
            interval = settings.get('chart_interval')
        }
        this.interval = interval
        render.updateCalcMouseToPrice(0)
        settings.set('chart_interval', this.interval)
        this._getCandles()
            .then(candles => {
                this.series.setData(candles)
                this.volumeSeries.setData(candles)
                this.chart.timeScale().fitContent()
                this.chart.applyOptions({
                    rightPriceScale: {
                        autoScale: 1
                    },
                    priceFormat: {
                        type: 'price',
                        precision: this.symbol.data.pricePrecision,
                    },
                    watermark: {
                        text: this.symbol.nameSymbol + ' - ' + this.interval.toUpperCase()
                    }
                })
            })
            .then(() => {
                this._reConnectSocket().then()
            })
    }
    /**
     * Обработка ответа от сокета об обновлении свечи
     * @param kline
     * @private
     */
    _updateChart({data: {k: kline}}){
        const candle = {
            time: kline.T / 1000,
            open: parseFloat(kline.o),
            high: parseFloat(kline.h),
            low: parseFloat(kline.l),
            close: parseFloat(kline.c),
            value: parseFloat(kline.q),
            color: kline.o < kline.c ? "rgba(0, 150, 136, 0.8)" : "rgba(255,82,82, 0.8)"
        }
        this.series.update(candle)
        this.volumeSeries.update(candle)
    }
    /**
     * Инициализация графика и применения настроек к нему
     */
    _createChart(){
        this.chart = LightweightCharts.createChart($('#symbol-chart')[0], {
            autoSize: 1,
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            watermark: {
                visible: true,
                color: 'red', // Цвет текста
                fontSize: 18, // Размер шрифта
                font: 'Arial', // Шрифт
                vertAlign: 'top', // Вертикальное выравнивание текста (middle, top, bottom)
                horzAlign: 'left',
                borderVisible: false, // Видимость границы текста
            }
        });
        this.chart.timeScale().applyOptions({
            timeVisible: true,
            secondsVisible: true,
        });
        this.series = this.chart.addCandlestickSeries()
        this.volumeSeries = this.chart.addHistogramSeries({
            color: 'rgba(0, 128, 0, 0.5)', // Цвет гистограммы
            priceFormat: {
                type: 'volume', // Указываем, что данные представляют объем
            },
            priceScaleId: "",
        });
        this.volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: .8,
                bottom: 0
            }
        })
        this.chart.subscribeCrosshairMove(this._calcMouseToPrice.bind(this));
    }
    _calcMouseToPrice(param){
        if( param.point === undefined ) return
        let price = this.series.coordinateToPrice(param.point.y)
        let currentPrice = this.symbol.attributes.price.get()
        const percent = ((price - currentPrice) / currentPrice) * 100
        render.updateCalcMouseToPrice(percent.toFixed(2))
    }
}
window.modules = {
    volatility: class {
        constructor() {
            window.addEventListener('update_candle', this.updateVolatility.bind(this))
        }
        updateVolatility({detail: {name, close}}){
            /// переделать расчет волатильности
        }
    },
    volumeGrowth: class {
      volumeGrowthSymbols = []
      constructor() {
          window.addEventListener('update_candle', this.eventCallback.bind(this))
          window.addEventListener('close_candles', () => {
              this.volumeGrowthSymbols.length = 0
              render.removeVolumeGrowth() // очищаем список
          })
      }
      eventCallback({detail: {name, volume}}){
          const candles = modules.historyCandlesticks.historySymbolsCandles[name]
          if( !candles ) return
          const maxVolume = Math.max(...candles.map(e=>parseFloat(e.volume)))
          const index = maxVolume * settings.get('volumeGrowthRatio')
          if( volume > index &&
              !this.volumeGrowthSymbols.includes(name) )
          {
              this.volumeGrowthSymbols.push(name)
              render.appendVolumeGrowth(name) // добавление в список роста объемов

          }
      }
    },
    historyCandlesticks: class {
        historySymbolsCandles = {}
        constructor() {
            (async()=>{
                const names = Object.keys(window.symbols)
                await this.getHistoryCandlesticks(names)
                this.createSocket(names)
            })()
        }
        /**
         * Слушаем изменение свечей
         * @param names
         */
        createSocket(names){
            window.binance.createWebSocket(
                names.map(e=>`${e.toLowerCase()}@kline_${settings.get('historyCandleStick')}`).join('/'),
                this.callback.bind(this)
            ).then()
        }
        /**
         * Получение исторических свечей
         * @param names
         * @returns {Promise<void>}
         */
        async getHistoryCandlesticks(names){
            names.forEach(name => {
                window.binance.getApi('klines', {
                    symbol: name.toLowerCase(),
                    interval: settings.get('historyCandleStick'),
                    limit: settings.get('historyCandleStickCount') + 1 // +1 дополнительная свеча
                }).then(candles => {
                    candles.pop() // удаляем последнюю, так как она является текущей полученная по сокету
                    this.historySymbolsCandles[name] = candles.map(e=>({
                        openTime: e[0],
                        open: parseFloat(e[1]),
                        high: parseFloat(e[2]),
                        low: parseFloat(e[3]),
                        close: parseFloat(e[4]),
                        alt_volume: parseFloat(e[5]),
                        closeTime: e[6],
                        volume: parseFloat(e[7]),
                        trades: e[8]
                    }))
                })
            })
        }
        /**
         * Обработка ответа от сокета
         * @param data
         */
        callback({data}){
            const {s: name, k: {
                t: openTime,
                o: open,
                h: high,
                l: low,
                c: close,
                v: alt_volume,
                T: closeTime,
                q: volume,
                x: candleClose,
                n: trades
            }} = data

            if( candleClose )
            {
                if( !this.historySymbolsCandles[name] ) return
                this.historySymbolsCandles[name].shift()
                this.historySymbolsCandles[name].push({
                    openTime,
                    open: parseFloat(open),
                    high: parseFloat(high),
                    low: parseFloat(low),
                    close: parseFloat(close),
                    alt_volume: parseFloat(alt_volume),
                    closeTime,
                    volume: parseFloat(volume),
                    trades: parseFloat(trades)
                })
                window.dispatchEvent(new CustomEvent('close_candles'))
            }

            window.dispatchEvent(new CustomEvent('update_candle', {detail: {
                name,openTime,open,high,low,close,alt_volume,closeTime,volume,candleClose,trades
            }})) // оповещяем другие модули
        }
    },
    eventClicked: class {
        constructor() {
            this.createEventClick()
        }
        createEventClick(){
            $(document).on('click', '[data-filter]', e => {
                const target = $(e.target)
                const parentBlock = target.closest('#watch-list').find('.list')
                const vector = parseInt(target.attr('data-vector'))
                const attribute = `data-${target.data('filter')}`
                parentBlock.find('[data-symbol]')
                    .sort(function(a, b) {
                    const priceA = +parseFloat($(a).find(`[${attribute}]`).attr(attribute));
                    const priceB = +parseFloat($(b).find(`[${attribute}]`).attr(attribute));
                    return  vector ? (priceA > priceB ? 1 : -1) : (priceA < priceB ? 1 : -1)
                })
                    .prependTo(parentBlock)
                target.attr('data-vector', +!vector)
            })
            $(document).on('click','button[data-remove-settings]', () => {
                settings.removeSettings()
            })
        }
    },
    ticker: class {
        server = null
        constructor() {
            binance.createWebSocket('!ticker@arr', this.callback.bind(this)).then(server => this.server = server)
        }
        callback({data}){
            data.forEach(({s: name, P: priceChangePercent, c: price, q: volume}) => {
                const symbol = window.symbols[name]
                if( !symbol ) return false
                symbol.attributes.price.set(price)
                symbol.attributes.change_percent.set(priceChangePercent)
                symbol.attributes.volume.set(volume)
                window.render.updateElement(symbol, ['price','change_percent','volume'])
            })
        }
    }
}
window.onload = () => {
    (async()=>{
        try {
            await window.settings.loadSettings()
            const _symbols = await window.binance.getSymbols()
            // Создаем объекты Symbol и добавляем их в окружение
            _symbols.forEach(({ symbol, ...data }) => window.symbols[symbol] = new Symbol(symbol, data))
            // Генерируем список наблюдения
            render.generateWatchList()
            // Инициализируем модули
            Object.keys(window.modules).forEach(module => {
                this.modules[module] = new this.modules[module]()
            })
            // Устанавливаем символ и временной интервал для графика
            chart.setSymbol('ETHUSDT');
        } catch (error) {
            console.error('An error occurred during initialization:', error);
        }
    })()
}