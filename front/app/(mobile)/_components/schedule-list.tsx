import { CalendarClock, CheckCircle2, Clock3, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useEffect } from 'react'

export const ScheduleList = () => {
  const schedules = [
    {
      id: 1,
      name: 'Agenda 1',
      description: 'Agenda 1 description',
      date: '2026-03-18 10:00:00',
      status: 'confirmed',
      address: 'Rua tadato ochikubo, 189, Sertaneja, PR',
    },
    {
      id: 2,
      name: 'Agenda 2',
      description: 'Agenda 2 description',
      date: '2026-03-18 10:00:00',
      status: 'pending',
      address: 'Rua tadato ochikubo, 189, Sertaneja, PR',
    },
    {
      id: 3,
      name: 'Agenda 3',
      description: 'Agenda 3 description',
      date: '2026-03-18 10:00:00',
      status: 'pending',
      address: 'Rua tadato ochikubo, 189, Sertaneja, PR',
    },
    {
      id: 4,
      name: 'Agenda 4',
      description: 'Agenda 4 description',
      date: '2026-03-18 10:00:00',
      status: 'pending',
      address: 'Rua Santo Amaro da Purificação, 316, Joinville, SC',
    },
  ]

  return (
    <section className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock className="w-5 h-5 text-amber-500" />
        <h1 className="text-xl font-bold text-slate-800">Agendas do dia</h1>
        <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-semibold px-2 py-0.5 rounded-full">
          {schedules.length} visitas
        </span>
      </div>

      <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {schedules.map(schedule => (
          <ScheduleItem key={schedule.id} schedule={schedule} />
        ))}
      </div>
    </section>
  )
}

export const ScheduleItem = ({ schedule }: { schedule: Schedule }) => {
  const isConfirmed = schedule.status === 'confirmed'

  // const openInMaps = () => {
  //   const { latitude, longitude, name } = schedule
  //   // geo: abre o app de mapas nativo no Android/iOS
  //   // fallback para Google Maps no browser
  //   const geoUrl = `geo:${latitude},${longitude}?q=${latitude},${longitude}(${encodeURIComponent(name)})`
  //   const mapsUrl = `https://www.google.com/maps/place/${latitude},${longitude}/@${latitude},${longitude},17z`

  //   const isAndroid = /android/i.test(navigator.userAgent)
  //   const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  //   if (isAndroid || isIOS) {
  //     window.location.href = geoUrl
  //   } else {
  //     window.open(mapsUrl, '_blank')
  //   }
  // }
  const getMapsUrl = (address: string) => {
    const encoded = encodeURIComponent(address)
    return `https://maps.google.com/maps?q=${encoded}`
  }

  const getMapsUrlWaze = (address: string) => {
    const encoded = encodeURIComponent(address)
    return `https://waze.com/ul?q=${encoded}&navigate=yes`
  }

  const geocodeAddress = async (address: string) => {
    const encoded = encodeURIComponent(address)
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encoded}&format=json&limit=1`,
    )
    const data = await res.json()
    if (!data.length) return null
    return {
      latitude: parseFloat(data[0].lat),
      longitude: parseFloat(data[0].lon),
    }
  }

  const getDistanceMeters = (
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ) => {
    const R = 6371000 // raio da Terra em metros
    const dLat = ((lat2 - lat1) * Math.PI) / 180
    const dLng = ((lng2 - lng1) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const mostrarLocalizacao = async (address: string) => {
    const geocode = await geocodeAddress(address)
    if (geocode) {
      console.log(geocode)
    }
    navigator.geolocation.getCurrentPosition(position => {
      const distance = getDistanceMeters(
        position.coords.latitude,
        position.coords.longitude,
        geocode?.latitude ?? 0,
        geocode?.longitude ?? 0,
      )
      const distanceLabel =
        distance >= 1000
          ? `${(distance / 1000).toFixed(1)} km`
          : `${Math.round(distance)} metros`
      alert(`Distância: ${distanceLabel}`)
      // alert(`Latitude atual: ${position.coords.latitude}, Longitude atual: ${position.coords.longitude}
      //   Latitude da agenda: ${geocode?.latitude}, Longitude da agenda: ${geocode?.longitude}
      // `)
    })
  }

  useEffect(() => {
    const fetchGeocode = async () => {
      const geocode = await geocodeAddress(schedule.address)
      if (geocode) {
        console.log(geocode)
      }
    }
    void fetchGeocode()
  }, [schedule.address])

  return (
    <div
      className={`relative bg-white rounded-xl border p-4 shadow-sm transition-all hover:shadow-md ${
        isConfirmed ? 'border-green-200' : 'border-gray-200'
      }`}
    >
      {/* Barra lateral colorida */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${
          isConfirmed ? 'bg-green-500' : 'bg-amber-400'
        }`}
      />

      <div className="pl-2">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h2 className="font-semibold text-slate-800 leading-tight">
            <Link href={`/schedule/${schedule.id}`}>{schedule.name}</Link>
          </h2>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${
              isConfirmed
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isConfirmed ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Clock3 className="w-3 h-3" />
            )}
            {isConfirmed ? 'Confirmada' : 'Pendente'}
          </span>
        </div>

        {/* Descrição */}
        <p className="text-sm text-slate-500 mb-3 line-clamp-2">
          {schedule.address}
        </p>

        {/* Rodapé */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Clock3 className="w-3.5 h-3.5" />
            {formatDate(schedule.date)}
          </span>
          <div className="flex flex-col md:flex-row items-start gap-2">
            <a
              href={getMapsUrl(schedule.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-amber-600 font-medium hover:text-amber-700 active:scale-95 transition-transform"
            >
              <MapPin className="w-3.5 h-3.5" />
              Ver no mapa
            </a>
            <a
              href={getMapsUrlWaze(schedule.address)}
              target="_blank"
              rel="noopener noreferrer"
              className="md:hidden flex items-center gap-1 text-amber-600 font-medium hover:text-amber-700 active:scale-95 transition-transform"
            >
              <MapPin className="w-3.5 h-3.5" />
              Navegar com o Waze
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

interface Schedule {
  id: number
  name: string
  description: string
  date: string
  status: string
  address: string
}

const formatDate = (date: string) => {
  return new Date(date)
    .toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(',', ' às')
}
