import { Module, Global } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Global()
@Module({
  imports: [
    ...(process.env.NODE_ENV !== 'test'
      ? [
          PrometheusModule.register({
            path: '/metrics',
            defaultMetrics: {
              enabled: true,
              config: {
                prefix: 'nestjs_',
              },
            },
          }),
        ]
      : [
          PrometheusModule.register({
            path: '/metrics',
            defaultMetrics: {
              enabled: false, // Disable default metrics in tests
            },
          }),
        ]),
  ],
  exports: [PrometheusModule],
})
export class SharedMetricsModule {}
