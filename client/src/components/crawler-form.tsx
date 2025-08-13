import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Rocket, Play, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { type CrawlFormData } from "@/lib/types";

const formSchema = z.object({
  targetUrl: z.string().url("Please enter a valid URL"),
  maxPages: z.number().min(1, "Must be at least 1").max(1000, "Cannot exceed 1000"),
  timeout: z.number().min(2, "Must be at least 2 seconds").max(60, "Cannot exceed 60 seconds"),
  includeCssBackgrounds: z.boolean(),
});

interface CrawlerFormProps {
  onCrawlStart: (crawlId: string) => void;
  activeCrawlId: string | null;
}

export default function CrawlerForm({ onCrawlStart, activeCrawlId }: CrawlerFormProps) {
  const { toast } = useToast();
  
  const form = useForm<CrawlFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      targetUrl: "",
      maxPages: 100,
      timeout: 10,
      includeCssBackgrounds: true,
    },
  });

  const startCrawlMutation = useMutation({
    mutationFn: async (data: CrawlFormData) => {
      // Convert timeout from seconds to milliseconds for the API
      const apiData = { ...data, timeout: data.timeout * 1000 };
      const response = await apiRequest('POST', '/api/crawl', apiData);
      return response.json();
    },
    onSuccess: (data) => {
      onCrawlStart(data.id);
      toast({
        title: "Crawl Started",
        description: "The image crawling process has begun.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start crawl",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CrawlFormData) => {
    startCrawlMutation.mutate(data);
  };

  const isDisabled = !!activeCrawlId || startCrawlMutation.isPending;

  return (
    <Card className="modern-card border-0 shadow-2xl">
      <CardContent className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center">
            <Rocket className="text-white" size={20} />
          </div>
          <h2 className="text-xl font-bold text-foreground">Start Crawling</h2>
        </div>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            {/* URL Input - Full Width */}
            <FormField
              control={form.control}
              name="targetUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-semibold text-foreground">
                    Target Website URL
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        type="url"
                        placeholder="https://example.com"
                        className="modern-input pl-4 pr-12 py-3 text-foreground placeholder:text-muted-foreground"
                        data-testid="input-target-url"
                      />
                      <div className="absolute inset-y-0 right-0 pr-4 flex items-center">
                        <Globe className="text-muted-foreground" size={18} />
                      </div>
                    </div>
                  </FormControl>
                  <p className="text-xs text-muted-foreground">Only same-origin pages will be crawled</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Bento Grid Layout for Options */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Crawl Options</h3>
              
              <div className="grid grid-cols-6 gap-4">
                {/* Max Pages - 2 columns */}
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="maxPages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">Max Pages</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min="1"
                            max="1000"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            className="modern-input text-sm py-2"
                            data-testid="input-max-pages"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Timeout - 2 columns */}
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="timeout"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-semibold text-foreground">Timeout (sec)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            min="2"
                            max="60"
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            className="modern-input text-sm py-2"
                            data-testid="input-timeout"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* CSS Backgrounds - 2 columns */}
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="includeCssBackgrounds"
                    render={({ field }) => (
                      <FormItem className="h-full">
                        <FormLabel className="text-sm font-semibold text-foreground">CSS Backgrounds</FormLabel>
                        <div className="flex items-center justify-center h-12 bg-card rounded-xl border border-border mt-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="h-5 w-5 text-primary focus:ring-primary border-border rounded"
                              data-testid="checkbox-include-css-bg"
                            />
                          </FormControl>
                          <span className="ml-3 text-sm text-muted-foreground">Include</span>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit"
              disabled={isDisabled}
              className="modern-button w-full py-3 text-lg font-semibold shadow-lg hover:shadow-xl"
              data-testid="button-start-crawl"
            >
              <Play className="mr-3" size={20} />
              {startCrawlMutation.isPending ? "Starting..." : "Start Crawling"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
